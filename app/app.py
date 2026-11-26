"""EBS-demo backend: serveert de presentatie en voert de demo-stappen uit.

Eén Lambda achter een Function URL:
  GET  /              -> static/index.html (de slides)
  POST /api/status    -> live status van de demo-resources (publiek, read-only)
  POST /api/<actie>   -> demo-stap uitvoeren (vereist demo-sleutel)
  EventBridge (elke 5 min) -> reaper: verwijdert alles ouder dan MAX_AGE_MIN

Elke actie geeft het equivalente AWS CLI-commando terug (met de echte ID's),
zodat het publiek ziet wat er gebeurt. Uitgevoerd wordt via boto3 / SSM Run Command.
"""
import base64
import datetime as dt
import json
import os

import boto3

ec2 = boto3.client("ec2")
ssm = boto3.client("ssm")

# config.json wordt door Terraform geschreven (geen env vars: KMS is geblokkeerd in het Howest-account)
with open(os.path.join(os.path.dirname(__file__), "config.json"), encoding="utf-8") as _f:
    CFG = json.load(_f)
TAG = CFG["TAG"]
DEMO_KEY = CFG["DEMO_KEY"]
AMI_ID = CFG["AMI_ID"]
SUBNET_ID = CFG["SUBNET_ID"]
SG_ID = CFG["SG_ID"]
PROFILE = CFG["INSTANCE_PROFILE"]
MAX_AGE_MIN = int(CFG["MAX_AGE_MIN"])
STATIC = os.path.join(os.path.dirname(__file__), "static")
TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript",
         ".svg": "image/svg+xml"}

TAGS = [{"Key": "Project", "Value": TAG}]
ALIVE = ["pending", "running", "stopping", "stopped"]

# Commando's die op de instance mogen draaien (geen vrije invoer).
# "show" = wat op de slide en in de terminal staat, "run" = wat SSM uitvoert (als root).
FIND_DEV = ("DEV=$(lsblk -dpno NAME,SERIAL | awk -v s=\"{serial}\" '$2==s{{print $1}}')\n"
            "[ \"$DEV\" = /dev/nvme1n1 ] || echo \"# let op: demo-volume is $DEV\"")
SHELL = {
    "lsblk": {"show": "lsblk", "run": "lsblk"},
    "mkfs": {
        "show": "sudo mkfs -t xfs /dev/nvme1n1",
        "run": FIND_DEV + "\nmkfs -t xfs $DEV",
    },
    "mount": {
        "show": "sudo mkdir -p /data\nsudo mount /dev/nvme1n1 /data\necho \"hallo EBS\" | sudo tee /data/test.txt\ndf -h /data",
        "run": FIND_DEV + "\nmkdir -p /data\nmount $DEV /data\necho \"hallo EBS\" | tee /data/test.txt\ndf -h /data",
    },
    "grow": {
        "show": "lsblk /dev/nvme1n1\nsudo xfs_growfs -d /data\ndf -h /data\ncat /data/test.txt",
        "run": FIND_DEV + "\nlsblk $DEV\nxfs_growfs -d /data\ndf -h /data\ncat /data/test.txt",
    },
}


# ---------------------------------------------------------------- helpers
def now():
    return dt.datetime.now(dt.timezone.utc)


def resp(status, body, ctype="application/json"):
    if not isinstance(body, str):
        body = json.dumps(body, default=str)
    return {"statusCode": status, "headers": {"content-type": ctype, "cache-control": "no-store"}, "body": body}


def tag_filter():
    return [{"Name": "tag:Project", "Values": [TAG]}]


def instances():
    r = ec2.describe_instances(Filters=tag_filter() + [{"Name": "instance-state-name", "Values": ALIVE}])
    return sorted((i for res in r["Reservations"] for i in res["Instances"]),
                  key=lambda i: i["LaunchTime"], reverse=True)


def volumes(data_only=True):
    f = tag_filter() + ([{"Name": "tag:Name", "Values": ["ebs-demo-data"]}] if data_only else [])
    return sorted(ec2.describe_volumes(Filters=f)["Volumes"], key=lambda v: v["CreateTime"], reverse=True)


def snapshots():
    return ec2.describe_snapshots(OwnerIds=["self"], Filters=tag_filter())["Snapshots"]


def need_instance():
    inst = [i for i in instances() if i["State"]["Name"] == "running"]
    if not inst:
        raise ValueError("Geen draaiende demo-instance. Voer eerst stap 1 uit.")
    return inst[0]


def need_volume():
    v = [v for v in volumes() if v["State"] in ("available", "in-use", "creating")]
    if not v:
        raise ValueError("Geen demo-volume. Voer eerst stap 2 uit.")
    return v[0]


# ---------------------------------------------------------------- acties
def status(_):
    out = {"now": now(), "maxAgeMin": MAX_AGE_MIN, "instance": None, "volume": None, "root": None, "snapshots": [],
           "infra": {"region": os.environ.get("AWS_REGION"), "function": os.environ.get("AWS_LAMBDA_FUNCTION_NAME"),
                     "ami": AMI_ID, "subnet": SUBNET_ID, "sg": SG_ID, "profile": PROFILE, "tag": TAG}}
    inst = instances()
    if inst:
        i = inst[0]
        root_id = next((b["Ebs"]["VolumeId"] for b in i.get("BlockDeviceMappings", [])
                        if b["DeviceName"] == i.get("RootDeviceName")), None)
        if root_id:
            rv = ec2.describe_volumes(VolumeIds=[root_id])["Volumes"][0]
            out["root"] = {"id": root_id, "size": rv["Size"], "type": rv["VolumeType"], "state": rv["State"]}
        ping = None
        if i["State"]["Name"] == "running":
            info = ssm.describe_instance_information(
                Filters=[{"Key": "InstanceIds", "Values": [i["InstanceId"]]}])["InstanceInformationList"]
            ping = info[0]["PingStatus"] if info else "Registering"
        out["instance"] = {"id": i["InstanceId"], "state": i["State"]["Name"], "type": i["InstanceType"],
                           "az": i["Placement"]["AvailabilityZone"], "launched": i["LaunchTime"], "ssm": ping,
                           "ip": i.get("PublicIpAddress"), "ami": i["ImageId"]}
    vols = [v for v in volumes() if v["State"] != "deleted"]
    if vols:
        v = vols[0]
        mod = None
        try:
            m = ec2.describe_volumes_modifications(VolumeIds=[v["VolumeId"]])["VolumesModifications"]
            if m:
                mod = {"state": m[0]["ModificationState"], "progress": m[0].get("Progress")}
        except ec2.exceptions.ClientError:
            pass
        out["volume"] = {"id": v["VolumeId"], "size": v["Size"], "type": v["VolumeType"], "iops": v.get("Iops"),
                         "throughput": v.get("Throughput"), "state": v["State"], "encrypted": v["Encrypted"],
                         "az": v["AvailabilityZone"], "created": v["CreateTime"], "modification": mod}
    out["snapshots"] = [{"id": s["SnapshotId"], "state": s["State"], "progress": s.get("Progress"),
                         "started": s["StartTime"]} for s in snapshots()]
    return out


def launch(_):
    cleaned = cleanup(None)  # altijd met een propere lei beginnen
    r = ec2.run_instances(
        ImageId=AMI_ID, InstanceType="t3.micro", MinCount=1, MaxCount=1,
        SubnetId=SUBNET_ID, SecurityGroupIds=[SG_ID], IamInstanceProfile={"Name": PROFILE},
        MetadataOptions={"HttpTokens": "required"},
        InstanceInitiatedShutdownBehavior="terminate",
        UserData="#!/bin/bash\nshutdown -h +30\n",  # vangnet: na 30 min uit -> getermineerd
        BlockDeviceMappings=[{"DeviceName": "/dev/xvda", "Ebs": {
            "VolumeSize": 8, "VolumeType": "gp3", "DeleteOnTermination": True}}],
        TagSpecifications=[
            {"ResourceType": "instance", "Tags": TAGS + [{"Key": "Name", "Value": "ebs-demo-instance"}]},
            {"ResourceType": "volume", "Tags": TAGS + [{"Key": "Name", "Value": "ebs-demo-root"}]},
        ],
    )
    i = r["Instances"][0]
    pre = f"# vooraf opgeruimd: {cleaned['output']}\n" if cleaned["output"] else ""
    return {"cmd": f"aws ec2 run-instances --image-id {AMI_ID} --instance-type t3.micro \\\n"
                   f"  --subnet-id {SUBNET_ID} --iam-instance-profile Name={PROFILE} \\\n"
                   f"  --instance-initiated-shutdown-behavior terminate",
            "output": pre + f"InstanceId: {i['InstanceId']}\nState:      {i['State']['Name']}\n"
                            f"AZ:         {i['Placement']['AvailabilityZone']}"}


def create_volume(_):
    i = need_instance()
    az = i["Placement"]["AvailabilityZone"]
    if [v for v in volumes() if v["State"] in ("available", "in-use", "creating")]:
        raise ValueError("Er bestaat al een demo-volume.")
    v = ec2.create_volume(AvailabilityZone=az, Size=5, VolumeType="gp3",
                          TagSpecifications=[{"ResourceType": "volume",
                                              "Tags": TAGS + [{"Key": "Name", "Value": "ebs-demo-data"}]}])
    vid = v["VolumeId"]
    ec2.get_waiter("volume_available").wait(VolumeIds=[vid], WaiterConfig={"Delay": 2, "MaxAttempts": 15})
    ec2.attach_volume(VolumeId=vid, InstanceId=i["InstanceId"], Device="/dev/sdf")
    ec2.get_waiter("volume_in_use").wait(VolumeIds=[vid], WaiterConfig={"Delay": 2, "MaxAttempts": 15})
    # vangnet: volume verdwijnt mee als de instance getermineerd wordt
    ec2.modify_instance_attribute(InstanceId=i["InstanceId"], BlockDeviceMappings=[
        {"DeviceName": "/dev/sdf", "Ebs": {"DeleteOnTermination": True}}])
    d = ec2.describe_volumes(VolumeIds=[vid])["Volumes"][0]
    return {"cmd": f"aws ec2 create-volume --availability-zone {az} --size 5 --volume-type gp3\n"
                   f"aws ec2 attach-volume --volume-id {vid} --instance-id {i['InstanceId']} --device /dev/sdf",
            "output": f"VolumeId:   {vid}\nType:       {d['VolumeType']}  {d['Size']} GiB\n"
                      f"IOPS:       {d.get('Iops')}\nThroughput: {d.get('Throughput')} MiB/s\n"
                      f"Encrypted:  {d['Encrypted']}\nAZ:         {az}\nState:      {d['State']}"}


def shell(body):
    step = body.get("step")
    if step not in SHELL:
        raise ValueError("Onbekende stap")
    i = need_instance()
    info = ssm.describe_instance_information(
        Filters=[{"Key": "InstanceIds", "Values": [i["InstanceId"]]}])["InstanceInformationList"]
    if not info or info[0]["PingStatus"] != "Online":
        raise ValueError("De SSM-agent is nog niet online. Wacht tot de statusbalk 'SSM Online' toont (± 1 min).")
    script = SHELL[step]["run"]
    if "{serial}" in script:
        script = script.format(serial=need_volume()["VolumeId"].replace("-", ""))
    c = ssm.send_command(InstanceIds=[i["InstanceId"]], DocumentName="AWS-RunShellScript",
                         Parameters={"commands": [script]}, TimeoutSeconds=60)
    return {"cmd": SHELL[step]["show"], "commandId": c["Command"]["CommandId"], "instanceId": i["InstanceId"]}


def output(body):
    try:
        r = ssm.get_command_invocation(CommandId=body["commandId"], InstanceId=body["instanceId"])
    except ssm.exceptions.InvocationDoesNotExist:
        return {"status": "Pending", "output": ""}
    return {"status": r["Status"], "output": (r["StandardOutputContent"] + r["StandardErrorContent"]).strip()}


def modify(_):
    v = need_volume()
    if v["Size"] >= 10:
        raise ValueError("Volume is al vergroot (de demo doet één wijziging).")
    r = ec2.modify_volume(VolumeId=v["VolumeId"], Size=10)["VolumeModification"]
    return {"cmd": f"aws ec2 modify-volume --volume-id {v['VolumeId']} --size 10",
            "output": f"OriginalSize: {r['OriginalSize']} GiB\nTargetSize:   {r['TargetSize']} GiB\n"
                      f"State:        {r['ModificationState']}"}


def snapshot(_):
    v = need_volume()
    s = ec2.create_snapshot(VolumeId=v["VolumeId"], Description="ebs-demo",
                            TagSpecifications=[{"ResourceType": "snapshot", "Tags": TAGS}])
    return {"cmd": f"aws ec2 create-snapshot --volume-id {v['VolumeId']} --description ebs-demo",
            "output": f"SnapshotId: {s['SnapshotId']}\nState:      {s['State']}\n"
                      f"VolumeSize: {s['VolumeSize']} GiB\nEncrypted:  {s['Encrypted']}"}


def snapshot_status(_):
    snaps = snapshots()
    if not snaps:
        raise ValueError("Geen demo-snapshot. Voer eerst de snapshot-stap uit.")
    s = snaps[0]
    return {"cmd": f"aws ec2 describe-snapshots --snapshot-ids {s['SnapshotId']}",
            "output": f"SnapshotId: {s['SnapshotId']}\nState:      {s['State']}\nProgress:   {s.get('Progress')}\n"
                      f"VolumeSize: {s['VolumeSize']} GiB\nStartTime:  {s['StartTime']:%Y-%m-%d %H:%M:%S} UTC"}


def verify(_):
    """Controle na het opruimen: bestaat er nog iets met de demo-tag?"""
    vols = [v["VolumeId"] + " (" + v["State"] + ")" for v in volumes(data_only=False)]
    snaps = [s["SnapshotId"] for s in snapshots()]
    inst = [i["InstanceId"] + " (" + i["State"]["Name"] + ")" for i in instances()]
    return {"cmd": f"aws ec2 describe-instances --filters Name=tag:Project,Values={TAG}\n"
                   f"aws ec2 describe-volumes --filters Name=tag:Project,Values={TAG}\n"
                   f"aws ec2 describe-snapshots --owner-ids self --filters Name=tag:Project,Values={TAG}",
            "output": f"Instances: {inst or '[]'}\nVolumes:   {vols or '[]'}\nSnapshots: {snaps or '[]'}"}


def cleanup(_, older_than_min=None):
    """Verwijdert alle demo-resources (of enkel die ouder dan older_than_min)."""
    cutoff = now() - dt.timedelta(minutes=older_than_min) if older_than_min else None
    old = (lambda t: True) if cutoff is None else (lambda t: t < cutoff)
    done, cmds = [], []
    for s in snapshots():
        if old(s["StartTime"]):
            ec2.delete_snapshot(SnapshotId=s["SnapshotId"])
            cmds.append(f"aws ec2 delete-snapshot --snapshot-id {s['SnapshotId']}")
            done.append(f"snapshot {s['SnapshotId']} verwijderd")
    term = [i["InstanceId"] for i in instances() if old(i["LaunchTime"])]
    if term:
        ec2.terminate_instances(InstanceIds=term)
        cmds.append(f"aws ec2 terminate-instances --instance-ids {' '.join(term)}")
        done += [f"instance {i} getermineerd (root + data-volume verdwijnen mee)" for i in term]
    for v in volumes(data_only=False):
        if not old(v["CreateTime"]):
            continue
        if v["State"] == "available":
            ec2.delete_volume(VolumeId=v["VolumeId"])
            cmds.append(f"aws ec2 delete-volume --volume-id {v['VolumeId']}")
            done.append(f"volume {v['VolumeId']} verwijderd")
        elif v["State"] == "in-use" and not any(a["InstanceId"] in term for a in v["Attachments"]):
            ec2.detach_volume(VolumeId=v["VolumeId"], Force=True)
            done.append(f"volume {v['VolumeId']} losgemaakt (volgende ronde verwijderd)")
    return {"cmd": "\n".join(cmds) or "# niets op te ruimen", "output": "\n".join(done)}


ACTIONS = {"snapshot_status": snapshot_status, "verify": verify, "launch": launch, "create_volume": create_volume, "shell": shell,
           "output": output, "modify": modify, "snapshot": snapshot, "cleanup": cleanup}


# ---------------------------------------------------------------- entry
def static(path):
    parts = [p for p in path.strip("/").split("/") if p] or ["index.html"]
    if len(parts) == 2 and parts[0] == "icons":
        folder, name = os.path.join(STATIC, "icons"), parts[1]
    elif len(parts) == 1:
        folder, name = STATIC, parts[0]
    else:
        return resp(404, "Not found", "text/plain")
    if name not in os.listdir(folder):  # enkel bestaande bestanden: geen path traversal
        return resp(404, "Not found", "text/plain")
    with open(os.path.join(folder, name), encoding="utf-8") as f:
        r = resp(200, f.read(), TYPES.get(os.path.splitext(name)[1], "text/plain"))
    if parts[0] == "icons":
        r["headers"]["cache-control"] = "public, max-age=86400"
    return r


def handler(event, _ctx):
    if event.get("source") == "aws.events" or event.get("reaper"):
        r = cleanup(None, older_than_min=MAX_AGE_MIN)
        print(json.dumps(r))
        return r

    path = event.get("rawPath", "/")
    if not path.startswith("/api/"):
        return static(path)
    if event["requestContext"]["http"]["method"] != "POST":
        return resp(405, {"error": "POST verwacht"})

    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode()
    try:
        body = json.loads(raw)
    except ValueError:
        body = {}

    action = path[len("/api/"):]
    try:
        if action == "status":  # read-only: ook zonder sleutel (kijkmodus)
            return resp(200, status(body))
        key = (event.get("headers") or {}).get("x-demo-key") or body.get("key")
        if key != DEMO_KEY:
            return resp(401, {"error": "Foute of ontbrekende demo-sleutel"})
        if action not in ACTIONS:
            return resp(404, {"error": "Onbekende actie"})
        return resp(200, ACTIONS[action](body))
    except ValueError as e:
        return resp(400, {"error": str(e)})
    except Exception as e:  # noqa: BLE001 - fout tonen op de slide
        print(repr(e))
        return resp(500, {"error": f"{type(e).__name__}: {e}"})
