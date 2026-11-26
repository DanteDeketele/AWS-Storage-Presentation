// ───────────────────────── woordenlijst: klik op een moeilijk woord ─────────────────────────
// short = korte uitleg in de popover · more = "extra slide" met uitgebreide uitleg (optioneel)
// match = woorden/varianten die in de slides gelinkt worden (hoofdletterongevoelig)
const GLOSSARY = {
  block: {
    title: 'Block storage', icon: 'ebs', match: ['block storage', 'block'],
    short: 'Opslag als ruwe schijf: data in blokken van vaste grootte, elk met een adres. Het besturingssysteem zet er zelf een filesystem op.',
    more: `<p>Het besturingssysteem ziet een block-volume als een gewone harde schijf. Het kent de bestanden niet: het leest en schrijft enkel blokken op een adres.</p>
      <ul><li>Wijzig je één record in een database, dan wordt enkel dat ene blok herschreven.</li>
      <li>Daardoor is de latency laag: ideaal voor databases en boot-schijven.</li>
      <li>Nadeel: meestal aan één server tegelijk gekoppeld.</li></ul>
      <p class="muted">Op AWS: Amazon EBS (netwerkschijf) en instance store (fysiek in de host).</p>`,
  },
  file: {
    title: 'File storage', icon: 'efs', match: ['file storage'],
    short: 'Opslag als bestanden in mappen, gedeeld over het netwerk via NFS of SMB. Meerdere servers kunnen tegelijk aan dezelfde bestanden.',
  },
  object: {
    title: 'Object storage', icon: 's3', match: ['object storage'],
    short: 'Elk bestand is een object (data + key + metadata) in een platte bucket, bereikbaar via een HTTPS-API. Vrijwel onbeperkt schaalbaar.',
  },
  metadata: {
    title: 'Metadata', match: ['metadata'],
    short: 'Data over de data: naam, grootte, type, datum, of eigen labels. Bij object storage kun je zelf metadata toevoegen.',
  },
  ebs: {
    title: 'Amazon EBS', icon: 'ebs', match: ['Amazon EBS', 'EBS-volume', 'EBS'],
    short: 'Elastic Block Store: block storage als netwerkschijf voor EC2. Een volume leeft in één Availability Zone en blijft bestaan als je de instance stopt.',
    more: `<ul><li>Gerepliceerd binnen één AZ (niet over AZ's heen).</li>
      <li>Losmaken en aan een andere instance in dezelfde AZ hangen kan.</li>
      <li>Je betaalt per GB-maand die je <b>provisioneert</b>, niet per GB die je gebruikt.</li>
      <li>Snapshots maken het volume regionaal herstelbaar.</li></ul>`,
  },
  s3: { title: 'Amazon S3', icon: 's3', match: ['S3'], short: 'Simple Storage Service: de object storage van AWS. EBS-snapshots worden achter de schermen in S3 bewaard.' },
  efs: { title: 'Amazon EFS', icon: 'efs', match: ['EFS'], short: 'Elastic File System: beheerde NFS-file storage, door veel EC2-instances tegelijk te mounten, over AZ\'s heen.' },
  fsx: { title: 'Amazon FSx', match: ['FSx'], short: 'Beheerde file systems van een bekend type: Windows File Server (SMB), Lustre, NetApp ONTAP of OpenZFS.' },
  nfs: { title: 'NFS / SMB', match: ['NFS', 'SMB'], short: 'Netwerkprotocollen om bestanden te delen. NFS komt uit de Linux/Unix-wereld, SMB uit Windows.' },
  iscsi: { title: 'iSCSI / Fibre Channel', match: ['iSCSI', 'Fibre Channel'], short: 'Protocollen om block storage over een netwerk aan te bieden, zodat een server het als lokale schijf ziet.' },
  rest: { title: 'REST API', match: ['REST API', 'HTTPS REST API', 'HTTPS-API'], short: 'Een interface via HTTP(S): je vraagt of stuurt data met GET, PUT, DELETE... Zo spreek je S3 aan.' },
  datalake: { title: 'Data lake', match: ['data lake'], short: 'Een centrale opslag van grote hoeveelheden ruwe data (logs, sensordata, ...) voor analyse later. Meestal op object storage.' },
  nvme: {
    title: 'NVMe', match: ['NVMe', 'nvme1n1'],
    short: 'Een snel protocol voor SSD\'s. Op Nitro-instances verschijnen EBS-volumes als NVMe-schijven, bv. /dev/nvme1n1, ook al vroeg je /dev/sdf.',
    more: `<p>Bij <code>attach-volume</code> geef je een apparaatnaam op zoals <code>/dev/sdf</code>. Op Nitro-instances hernoemt Linux die naar <code>/dev/nvme0n1</code>, <code>/dev/nvme1n1</code>, ...</p>
      <ul><li>De volgorde is niet gegarandeerd.</li>
      <li>Daarom controleer je altijd met <code>lsblk</code> welke schijf de juiste grootte heeft.</li>
      <li>Het serienummer van de NVMe-schijf bevat het volume-ID: <code>lsblk -o NAME,SERIAL</code>.</li></ul>`,
  },
  nitro: { title: 'AWS Nitro System', match: ['Nitro-instances', 'Nitro'], short: 'De hardware- en hypervisorbasis van moderne EC2-instances. Netwerk, opslag en encryptie gebeuren op aparte Nitro-kaarten.' },
  iops: {
    title: 'IOPS', match: ['IOPS'],
    short: 'Input/Output Operations Per Second: hoeveel lees- of schrijfacties een schijf per seconde aankan. Belangrijk voor databases met veel kleine acties.',
    more: `<p>Twee maten voor snelheid:</p>
      <ul><li><b>IOPS</b>: aantal acties per seconde. Telt bij veel kleine, willekeurige acties (databases).</li>
      <li><b>Throughput</b>: hoeveel MiB per seconde. Telt bij grote, sequentiële stromen (logs, video, big data).</li></ul>
      <p>gp3 geeft standaard 3.000 IOPS en 125 MiB/s, los van de grootte. Bij gp2 hangt het af van de grootte: 3 IOPS per GiB.</p>
      <p class="muted">HDD-types (st1, sc1) tellen IOPS met blokken van 1 MiB; SSD-types met kleinere blokken.</p>`,
  },
  throughput: { title: 'Throughput', match: ['throughput', 'MiB/s'], short: 'Doorvoersnelheid: hoeveel data per seconde (MiB/s). Belangrijk bij grote, sequentiële lees- en schrijfacties.' },
  latency: { title: 'Latency', match: ['latency'], short: 'Vertraging: hoe lang één lees- of schrijfactie duurt. io2 Block Express haalt gemiddeld onder 500 microseconden.' },
  durability: { title: 'Duurzaamheid', match: ['duurzaamheid'], short: 'De kans dat je volume een jaar lang niet faalt. 99,9% = maximaal 0,1% kans op falen per jaar. io2: 99,999%.' },
  gp3: {
    title: 'gp3', icon: 'res-gp3', match: ['gp3'],
    short: 'General Purpose SSD van de nieuwste generatie: 3.000 IOPS en 125 MiB/s inbegrepen, extra prestaties los bij te kopen. De standaardkeuze.',
    more: `<ul><li>1 GiB – 64 TiB, tot 80.000 IOPS en 2.000 MiB/s.</li>
      <li>Max. 500 IOPS per GiB: voor 5.000 IOPS heb je minstens 10 GiB nodig.</li>
      <li>Frankfurt: $0,0952 per GB-maand, $0,006 per extra IOPS, $0,0476 per extra MiB/s.</li>
      <li>Geen burst credits: altijd de geprovisioneerde snelheid.</li></ul>`,
  },
  gp2: { title: 'gp2', match: ['gp2'], short: 'Oudere General Purpose SSD: 3 IOPS per GiB (min. 100, max. 16.000). Kleine volumes werken met burst credits. Duurder dan gp3.' },
  io2: { title: 'io2 Block Express', match: ['io2 Block Express', 'io2'], short: 'Provisioned IOPS SSD voor de zwaarste databases: tot 256.000 IOPS, 99,999% duurzaamheid, Multi-Attach.' },
  st1: { title: 'st1', match: ['st1'], short: 'Throughput Optimized HDD: goedkope harde schijf voor grote sequentiële data (logs, Kafka). Niet als boot-volume.' },
  sc1: { title: 'sc1', match: ['sc1'], short: 'Cold HDD: de goedkoopste EBS-schijf ($0,018/GB) voor data die je zelden leest. Niet als boot-volume. Vaak is S3 een beter idee.' },
  burst: {
    title: 'Burst credits', match: ['burst credits', 'burst'],
    short: 'Bij gp2 onder 1 TiB spaar je I/O-credits als de schijf rustig is, en mag je tijdelijk tot 3.000 IOPS. Zijn de credits op, dan zak je terug naar de basissnelheid.',
    more: `<p>Voorbeeld: een gp2-volume van 100 GiB heeft een basis van 300 IOPS.</p>
      <ul><li>Rustige momenten → credits sparen.</li>
      <li>Druk moment → tijdelijk tot 3.000 IOPS.</li>
      <li>Credits op → terug naar 300 IOPS, en je applicatie wordt plots traag.</li></ul>
      <p>gp3 heeft geen credits: je krijgt altijd de geprovisioneerde snelheid. Dat is voorspelbaarder.</p>`,
  },
  multiattach: { title: 'Multi-Attach', match: ['Multi-Attach'], short: 'Eén io1/io2-volume tegelijk aan meerdere instances in dezelfde AZ koppelen. Je applicatie moet zelf zorgen dat ze elkaar niet overschrijven.' },
  boot: { title: 'Boot-volume', match: ['boot-volume', 'boot-schijf', 'boot-schijven', 'root volume', 'Root volume'], short: 'Het volume waarop het besturingssysteem staat en waarvan de instance opstart. HDD-types (st1, sc1) kunnen dat niet.' },
  az: {
    title: 'Availability Zone (AZ)', match: ['Availability Zone', 'AZ'],
    short: 'Eén of meer aparte datacenters binnen een regio, met eigen stroom en netwerk. Een EBS-volume leeft in één AZ.',
    more: `<p>Frankfurt (eu-central-1) heeft drie AZ's: eu-central-1a, -1b en -1c.</p>
      <ul><li>Een EBS-volume kan enkel aan een instance in <b>dezelfde AZ</b>.</li>
      <li>Valt een AZ uit, dan is het volume onbereikbaar.</li>
      <li>Verhuizen naar een andere AZ: snapshot nemen → nieuw volume maken in de andere AZ.</li></ul>`,
  },
  region: { title: 'Region', match: ['regio', 'region', 'regionaal'], short: 'Een geografisch gebied met meerdere AZ\'s, bv. eu-central-1 (Frankfurt). Snapshots zijn regionaal: bruikbaar in elke AZ van die regio.' },
  snapshot: {
    title: 'EBS snapshot', icon: 'res-snapshot', match: ['snapshots', 'snapshot'],
    short: 'Een point-in-time back-up van een volume, bewaard in S3. Incrementeel en regionaal: je maakt er een nieuw volume van in eender welke AZ.',
    more: `<p>Hoe incrementeel werkt:</p>
      <ul><li>Snapshot 1: alle gebruikte blokken (bv. 4 GB).</li>
      <li>Snapshot 2: enkel de blokken die sindsdien veranderden (bv. 200 MB).</li>
      <li>Verwijder je snapshot 1, dan bewaart AWS de blokken die snapshot 2 nog nodig heeft. Elke snapshot blijft volledig herstelbaar.</li></ul>
      <p>Prijs Frankfurt: $0,054 per GB-maand (standard), $0,0135 (archive, min. 90 dagen, ophalen kost extra).</p>`,
  },
  incremental: { title: 'Incrementeel', match: ['incrementeel'], short: 'Enkel wat veranderd is sinds de vorige keer wordt opgeslagen. Spaart tijd en opslagkosten.' },
  pointintime: { title: 'Point-in-time', match: ['point-in-time'], short: 'Een momentopname: de toestand van het volume op exact het moment dat je de snapshot start.' },
  archive: { title: 'Snapshot archive', match: ['archive'], short: 'Een goedkopere opslagklasse voor snapshots die je lang bewaart: $0,0135/GB-maand, minimaal 90 dagen, terughalen duurt uren en kost per GB.' },
  kms: {
    title: 'AWS KMS', icon: 'kms', match: ['AWS KMS', 'KMS'],
    short: 'Key Management Service: beheert de sleutels voor encryptie. EBS vraagt er een data key aan om het volume met AES-256 te versleutelen.',
    more: `<ul><li>Standaard gebruikt EBS de AWS managed key <code>aws/ebs</code>; je kunt ook een eigen key kiezen.</li>
      <li>De encryptie zelf gebeurt in de Nitro-hardware: geen merkbaar prestatieverlies.</li>
      <li>Versleuteld: data at rest, verkeer tussen instance en volume, snapshots en volumes daaruit.</li></ul>
      <p class="muted">In ons demo-account blokkeert een SCP <code>kms:Encrypt</code>. Daarom zijn de demo-volumes niet versleuteld.</p>`,
  },
  aes: { title: 'AES-256', match: ['AES-256'], short: 'Een standaard encryptie-algoritme met een sleutel van 256 bits. Zonder de sleutel is de data onleesbaar.' },
  atrest: { title: 'At rest / in transit', match: ['at rest', 'in transit'], short: 'At rest = opgeslagen data op de schijf. In transit = data die onderweg is, hier tussen de EC2-instance en het EBS-volume.' },
  encdefault: { title: 'Encryption by default', match: ['Encryption by default'], short: 'Een instelling per account én per regio: elk nieuw EBS-volume wordt dan automatisch versleuteld. Bestaande volumes veranderen niet.' },
  scp: { title: 'SCP', match: ['SCP'], short: 'Service Control Policy: een regel van AWS Organizations die bepaalt wat een account maximaal mag, ook als IAM het toelaat. Ons demo-account blokkeert zo onder andere KMS-encryptie.' },
  elastic: {
    title: 'Elastic Volumes', match: ['Elastic Volumes'],
    short: 'Grootte, type, IOPS en throughput van een EBS-volume wijzigen terwijl het in gebruik is, zonder downtime.',
    more: `<ol><li><code>modify-volume</code>: AWS vergroot de schijf. Bij de state <code>optimizing</code> is de nieuwe grootte al bruikbaar.</li>
      <li>In het besturingssysteem: de partitie (indien aanwezig) en het filesystem uitbreiden.</li></ol>
      <ul><li>Verkleinen kan niet.</li>
      <li>Een volgende wijziging kan pas als de vorige <code>completed</code> is, met max. 4 wijzigingen per 24 uur.</li></ul>`,
  },
  optimizing: { title: 'optimizing', match: ['optimizing'], short: 'Status tijdens een volumewijziging. AWS verplaatst nog data op de achtergrond, maar de nieuwe grootte is al bruikbaar. Daarna: completed.' },
  partition: { title: 'Partitie', match: ['partitie', 'growpart'], short: 'Een afgebakend deel van een schijf. Staat het filesystem in een partitie, dan moet je eerst die partitie vergroten met growpart.' },
  filesystem: {
    title: 'Filesystem', match: ['filesystem', 'mkfs'],
    short: 'De structuur waarmee het OS bestanden en mappen op een schijf bijhoudt. Een nieuw EBS-volume is leeg: je maakt er eerst een filesystem op met mkfs.',
  },
  xfs: { title: 'xfs / ext4', match: ['xfs_growfs', 'xfs', 'ext4', 'resize2fs'], short: 'Twee Linux-filesystems. Amazon Linux gebruikt standaard xfs. Uitbreiden: xfs_growfs (op het mountpoint) of resize2fs (ext4).' },
  mount: { title: 'Mount', match: ['mounten', 'mount'], short: 'Een filesystem koppelen aan een map, bv. /data. Vanaf dan schrijf je in /data rechtstreeks naar het EBS-volume.' },
  lsblk: { title: 'lsblk', match: ['lsblk'], short: 'Linux-commando dat alle block devices (schijven en partities) met hun grootte toont.' },
  instancestore: {
    title: 'Instance store', match: ['instance store', 'instance-store'],
    short: 'Tijdelijke opslag op fysieke schijven in de host van je EC2-instance. Zeer snel, maar weg bij stop, hibernate of terminate.',
    more: `<p>Data <b>weg</b> bij:</p>
      <ul><li>stop/start (de instance komt op een andere host), hibernate, terminate</li>
      <li>defecte schijf, instance type wijzigen, instance retirement, shutdown vanuit het OS</li></ul>
      <p>Data <b>blijft</b> bij een reboot (zelfde host).</p>
      <p>Gebruik: cache, buffers, scratch, of data die elders gerepliceerd staat (Cassandra, Hadoop). Inbegrepen bij types met een "d", zoals <code>m5d</code>, of bij <code>i3</code>.</p>`,
  },
  hibernate: { title: 'Hibernate', match: ['hibernate'], short: 'Slaapstand: het RAM wordt op het EBS-root-volume bewaard en de instance stopt. Instance-store-data gaat daarbij verloren.' },
  terminate: { title: 'Terminate', match: ['terminate'], short: 'De instance definitief verwijderen. Volumes met DeleteOnTermination=true (standaard voor de root) worden mee verwijderd.' },
  reboot: { title: 'Reboot', match: ['reboot'], short: 'Herstarten van het OS. De instance blijft op dezelfde host, dus ook instance-store-data blijft bewaard.' },
  deleteonterm: { title: 'DeleteOnTermination', match: ['DeleteOnTermination'], short: 'Instelling per gekoppeld volume: wordt het mee verwijderd als de instance getermineerd wordt? Standaard ja voor de root, nee voor extra volumes.' },
  ec2: { title: 'Amazon EC2', icon: 'ec2', match: ['EC2-instance', 'EC2'], short: 'Elastic Compute Cloud: virtuele servers op AWS. Je kiest een type (bv. t3.micro) en een image (AMI).' },
  t3micro: { title: 't3.micro', match: ['t3.micro'], short: 'Een klein, goedkoop instance type: 2 vCPU, 1 GiB RAM. In Frankfurt $0,012 per uur.' },
  ami: { title: 'AMI / Amazon Linux 2023', match: ['Amazon Linux 2023', 'AMI'], short: 'Amazon Machine Image: de schijfafbeelding waarmee een instance opstart. Amazon Linux 2023 is de Linux-distributie van AWS, met de SSM-agent al geïnstalleerd.' },
  lambda: { title: 'AWS Lambda', icon: 'lambda', match: ['Lambda-functie', 'Lambda'], short: 'Serverless: code die enkel draait als ze aangeroepen wordt. Je betaalt per aanroep en per milliseconde. Deze slides worden door een Lambda geserveerd.' },
  ssm: { title: 'Systems Manager (SSM)', icon: 'ssm', match: ['SSM Run Command', 'Run Command', 'Session Manager', 'SSM'], short: 'AWS-dienst om instances te beheren zonder SSH. Run Command voert een script uit op de instance; de SSM-agent haalt het op.' },
  eventbridge: { title: 'Amazon EventBridge', icon: 'eventbridge', match: ['EventBridge'], short: 'Een event- en planningsdienst. Hier roept een regel elke 5 minuten onze Lambda aan om oude demo-resources op te ruimen.' },
  cloudshell: { title: 'AWS CloudShell', icon: 'cloudshell', match: ['CloudShell', 'AWS CLI'], short: 'De AWS CLI is de commandline-tool voor AWS. CloudShell is een terminal in de browser waar die al klaarstaat, met jouw rechten.' },
  tag: { title: 'Tag', match: ['tag'], short: 'Een label (key=value) op een AWS-resource. Alles wat de demo maakt krijgt Project=ebs-demo-live, zodat het gevonden en opgeruimd kan worden.' },
  nitrokey: { title: 'Provisioneren', match: ['geprovisioneerde', 'provisioneert', 'provisionen'], short: 'Vooraf vastleggen en reserveren. Bij EBS betaal je voor de geprovisioneerde grootte en prestaties, ook als je ze niet gebruikt.' },
  sequential: { title: 'Sequentieel', match: ['sequentiële'], short: 'Data die je in één lange stroom na elkaar leest of schrijft (logs, video). Daar zijn HDD\'s goed in; bij willekeurige kleine acties niet.' },
  ondemand: { title: 'GB-maand', match: ['GB-maand'], short: 'De eenheid van EBS-prijzen: 1 GB, een volledige maand lang. Per uur aangerekend: een volume van 10 GB voor 1 uur kost 10 × prijs / 730.' },
};

// ───── automatisch linken in de slides (eerste voorkomen per term per slide)
(function linkTerms() {
  const entries = [];
  for (const [key, g] of Object.entries(GLOSSARY)) for (const m of g.match) entries.push([m, key]);
  entries.sort((a, b) => b[0].length - a[0].length);            // langste eerst
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const L = 'A-Za-zÀ-ÿ0-9_';
  const re = new RegExp(`(?<![${L}/.-])(${entries.map(e => esc(e[0])).join('|')})(?![${L}])`, 'gi');
  const lookup = new Map(entries.map(([m, k]) => [m.toLowerCase(), k]));
  const SKIP = 'aside, pre, code, svg, button, h1, script, style, .term, .live, .steps-nav, .kicker, .term-link, th, label, .price, input';

  document.querySelectorAll('#stage .slide').forEach(slide => {
    const seen = new Set();
    const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.nodeValue.trim() && !n.parentElement.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const text = node.nodeValue;
      let last = 0, changed = false;
      const frag = document.createDocumentFragment();
      text.replace(re, (m, _g, offset) => {
        const key = lookup.get(m.toLowerCase());
        if (!key || seen.has(key)) return m;
        seen.add(key); changed = true;
        frag.append(text.slice(last, offset));
        const a = document.createElement('span');
        a.className = 'term-link'; a.dataset.term = key; a.textContent = m;
        a.tabIndex = 0; a.setAttribute('role', 'button');
        frag.append(a);
        last = offset + m.length;
        return m;
      });
      if (changed) { frag.append(text.slice(last)); node.replaceWith(frag); }
    });
  });
})();

// ───── popover + extra slide
const pop = document.getElementById('gloss-pop');
const deep = document.getElementById('gloss-deep');
let popKey = null;

function iconHtml(g, cls) { return g.icon ? `<img class="${cls}" src="icons/${g.icon}.svg" alt="">` : ''; }

function openPop(el) {
  const key = el.dataset.term, g = GLOSSARY[key];
  popKey = key;
  pop.innerHTML = `<div class="gp-head">${iconHtml(g, 'gp-ico')}<b>${g.title}</b><button class="gp-x" aria-label="Sluiten">✕</button></div>
    <p>${g.short}</p>
    ${g.more ? '<button class="btn primary gp-more">Extra slide →</button>' : ''}`;
  pop.classList.add('on');
  const r = el.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let x = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), innerWidth - w - 12);
  let y = r.bottom + 10;
  if (y + h > innerHeight - 12) y = Math.max(12, r.top - h - 10);
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
}
function closePop() { pop.classList.remove('on'); popKey = null; }

function openDeep(key) {
  const g = GLOSSARY[key];
  deep.querySelector('.gd-body').innerHTML = `
    <div class="kicker">Extra uitleg</div>
    <div class="head">${iconHtml(g, 'ico')}<h2>${g.title}</h2></div>
    <p class="gd-short">${g.short}</p>
    <div class="gd-more">${g.more || ''}</div>`;
  deep.classList.add('on');
  closePop();
}
function closeDeep() { deep.classList.remove('on'); }

document.addEventListener('click', e => {
  const t = e.target.closest('.term-link');
  if (t) { e.stopPropagation(); popKey === t.dataset.term && pop.classList.contains('on') ? closePop() : openPop(t); return; }
  if (e.target.closest('.gp-x')) { closePop(); return; }
  if (e.target.closest('.gp-more')) { openDeep(popKey); return; }
  if (e.target.closest('#gloss-deep .gd-back') || e.target === deep) { closeDeep(); return; }
  if (!e.target.closest('#gloss-pop')) closePop();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closePop(); closeDeep(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('term-link')) { e.preventDefault(); openPop(e.target); }
}, true);
document.addEventListener('slidechange', () => { closePop(); closeDeep(); });
