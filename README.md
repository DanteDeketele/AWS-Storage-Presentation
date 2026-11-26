# Block Storage & Amazon EBS: an interactive, self-hosting AWS talk

An interactive slide deck about block storage and Amazon EBS that **runs on AWS itself** and
**performs its own live demo**. Press *Run* on a demo slide and the deck launches a real EC2
instance, attaches a gp3 volume, formats and mounts it, grows it without downtime and takes a
snapshot. The real command output appears on the slide while you talk.

Everything is serverless and cleans up after itself: the deck costs about **$0 per week** to keep
online, and a full live demo costs about **one cent**.

> The slide content is in Dutch. The code, infrastructure and this README are language-neutral.

![Architecture](https://img.shields.io/badge/AWS-Lambda%20%7C%20EC2%20%7C%20EBS%20%7C%20SSM%20%7C%20EventBridge-232F3E?logo=amazonaws)
![IaC](https://img.shields.io/badge/IaC-Terraform-7B42BC?logo=terraform)

## Features

**Slide deck**
- Fixed 16:9 canvas that scales to any screen, with keyboard, mouse and touch navigation.
- AWS look and feel with the official [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/).
- Interactive slides:
  - clickable block / file / object storage cards;
  - a step-by-step EBS architecture diagram;
  - a live gp2 vs gp3 cost calculator;
  - an instance-store data-loss simulator.
- **Glossary:** more than 100 technical terms are clickable. Each opens a short explanation, and 15 key terms have a full extra slide.
- **Architecture overlay** on every slide: the full AWS setup, with the demo resources that exist right now highlighted live, real resource IDs and state. Two more tabs explain the Terraform resources and the commands.
- **Speaker notes**: a notes bar, or a separate **presenter window**. The presenter window shows the current and next slide, the notes and a timer. Clicks in its preview are forwarded to the audience screen, and a laser pointer mirrors your mouse there.
- Optional, synthesized sound effects (Web Audio API, no audio files).
- PDF export through the browser's print dialog, one slide per page.
- Controls and highlights hide automatically when the mouse is idle.

**Live demo (6 steps)**
1. Launch a `t3.micro` (Amazon Linux 2023). It is managed through SSM, with no SSH and no open ports.
2. Create a 5 GiB gp3 volume in the same AZ and attach it. `lsblk` shows it as an NVMe device.
3. `mkfs -t xfs`, mount it on `/data`, write a test file.
4. `modify-volume` to 10 GiB, then `xfs_growfs`. The file survives, with no downtime.
5. Snapshot, and poll its status.
6. Clean up and verify that nothing is left.

A live status bar shows the instance, volume (including modification state) and snapshot, the
time until auto-deletion, and the running cost. One button exports the full demo log as text.

## Architecture

```
                ┌──────────────── always on (≈ $0/week) ────────────────┐
Browser ─HTTPS─▶│ Lambda Function URL ─▶ Lambda (Python 3.13)           │
                │   ├─ GET  /        → slides (HTML/CSS/JS + icons)     │
                │   ├─ POST /api/*   → EC2 / EBS API + SSM Run Command  │
                │   └─ reaper        ◀─ EventBridge rule, every 5 min   │
                └───────────────────────────────────────────────────────┘
                ┌──────────── only during a demo (max ~20 min) ─────────┐
                │ default VPC · one AZ · security group without inbound │
                │ EC2 t3.micro + gp3 root + gp3 data volume · snapshot  │
                └───────────────────────────────────────────────────────┘
```

Terraform manages only the permanent part. The Lambda creates and deletes the demo resources at
runtime, and tags them all with `Project=ebs-demo-live`.

## Cost

| Resource | Runs | Cost |
|---|---|---|
| Lambda + Function URL, EventBridge rule, CloudWatch Logs (7 days), IAM, security group | permanently | ≈ $0 (Lambda free tier) |
| EC2 `t3.micro` + public IPv4 + 8 GiB gp3 root | only during a demo | ≈ $0.006 per 20 min |
| gp3 data volume 5 → 10 GiB + snapshot | only during a demo | < $0.001 |

No NAT gateway, load balancer, Elastic IP or always-on web server. Prices are for eu-central-1
(Frankfurt), taken from the AWS Price List API.

## Safety nets: nothing keeps running

| # | Trigger | What happens |
|---|---|---|
| 1 | Starting a new demo | Leftovers from a previous demo are deleted first |
| 2 | Leaving the demo slides | Everything is deleted |
| 3 | 10 min without interaction on a demo slide | Everything is deleted |
| 4 | Closing the tab | A cleanup beacon is sent |
| 5 | Every 5 min, server side | The reaper deletes anything older than 20 min, even if the browser crashed |
| 6 | 30 min after launch | The instance shuts itself down (`shutdown -h +30`, shutdown behavior *terminate*) |
| 7 | Instance terminated | The volumes go with it (`DeleteOnTermination=true`) |

**Least privilege.** The Lambda role can only launch `t3.micro`, only create gp3 volumes, and only
modify or delete resources that carry the demo tag. The demo API needs a generated key. Without
it, the deck runs in read-only *viewer mode*.

## Deploy

Requirements: an AWS account with CLI credentials, and Terraform ≥ 1.5.

```bash
cd terraform
terraform init
terraform apply
```

```bash
terraform output url                   # share this: viewer mode
terraform output -raw presenter_url    # keep this private: unlocks the Run buttons
```

The presenter URL stores the key in your browser and removes it from the address bar. You can also
enter the key with the **Sleutel** button. After you change anything in `app/`, run
`terraform apply` again: only the Lambda code is replaced, and the URL and key stay the same.

### Restricted accounts

Some organizations block `kms:Encrypt` with a Service Control Policy. That blocks both Lambda
environment-variable encryption and encrypted EBS volumes. This project works under that
restriction:

- configuration ships as `app/config.json` inside the deployment package, written by Terraform and git-ignored;
- the demo volumes are created unencrypted.

In an unrestricted account you can add `Encrypted=True` back in `app/app.py`.

### Tear down

```bash
terraform destroy
aws ec2 describe-volumes   --filters Name=tag:Project,Values=ebs-demo-live --query "Volumes[].VolumeId"
aws ec2 describe-snapshots --owner-ids self --filters Name=tag:Project,Values=ebs-demo-live --query "Snapshots[].SnapshotId"
```

Both checks should return `[]`.

## Controls

| Input | Action |
|---|---|
| `→` / space / **Volgende** | next bullet or slide |
| `←` / **Vorige** | previous |
| `F` | fullscreen |
| `A` | architecture overlay |
| `N` | speaker notes |
| `P` | PDF export (save as PDF, no margins, background graphics on) |
| `Esc` | close overlays |

## Project structure

```
app/
  app.py            Lambda: serves the deck, demo API, reaper
  static/
    index.html      slides + speaker notes (<aside class="notes">)
    style.css       AWS-style theme, print layout
    deck.js         navigation, scaling, interactive slides, architecture overlay
    demo.js         Run buttons, live status, auto-cleanup, demo log export
    glossary.js     clickable terms and extra slides
    notes.js        notes bar, presenter window, remote control
    sound.js        synthesized sound effects
    icons/          official AWS Architecture Icons (07/2026 release)
terraform/main.tf   all permanent infrastructure
presentation.md     storyline and fact-checked content
research.md         raw research notes
```

## Sources

The facts and figures come from the official AWS documentation: EBS volume types, snapshots,
encryption, Elastic Volumes, NVMe naming and instance store lifetime. Prices come from the AWS
Price List API. The full list is on the last slide.

## Credits

AWS Architecture Icons © Amazon Web Services, used under AWS's terms for architecture diagrams and
presentations. This is an independent educational project and is not affiliated with or
endorsed by AWS.
