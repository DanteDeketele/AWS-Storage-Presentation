# Research

Onderwerp 1: Block storage en Amazon EBS

    Wat is block storage? Wat is het verschil met object storage en file storage? Wanneer kies je wat?
    De EBS-volumetypes (gp3, gp2, io2, st1, sc1): verschillen, limieten, prijs in Frankfurt. Waarom kies je vandaag bijna altijd gp3?
    EBS en Availability Zones, snapshots, encryptie, een volume vergroten. Wat is een instance store en wanneer ben je die data kwijt?
    Demo: koppel een extra gp3-volume (max. 10 GB) aan een EC2-instance, maak er een filesystem op, mount het, vergroot het zonder downtime en neem een snapshot.


## Wat is block storage?

Block storage (also called block-level storage) is a data storage method that divides data into fixed-size chunks called blocks, each with a unique identifier. Systems can read, write, or update individual blocks directly without processing an entire file.


How It Works

• **Fixed-size blocks**: Data is split into equal-sized blocks (often ranging from a few kilobytes to a few megabytes depending on the system) and stored wherever capacity or performance is best.
• **Unique addresses and minimal metadata**: Each block has an address or identifier with minimal metadata, allowing fast lookup and retrieval.
• **Volumes and file systems**: Groups of blocks are presented as logical volumes that act like raw drives. An operating system or application formats the volume with a file system (or uses it directly) to manage data.
• **Low-latency edits**: Changing part of a file or database only updates the specific blocks that changed rather than rewriting the whole file.

## Verschil block storage vs object storage vs file storage

Het belangrijkste verschil tussen block storage, file storage en object storage zit in hoe data wordt opgeslagen, georganiseerd en benaderd: block splitst data in losse blokken voor maximale snelheid, file ordent bestanden in mappen voor eenvoudig delen, en object bewaart alles in één platte pool met uitgebreide metadata voor enorme schaalbaarheid.

Overzicht van de verschillen


Kenmerk	Block Storage	File Storage	Object Storage
Structuur	Vaste datablokken zonder mappenstructuur	Hiërarchisch (mappen en submappen)	Platte opslagpool (geen mappen)
Metadata	Minimaal (alleen een uniek adres/ID)	Basis (bestandsnaam, grootte, aanmaakdatum)	Uitgebreid en aanpasbaar (tags, eigenschappen)
Snelheid & Latency	Zeer hoog / extreem lage vertraging	Gemiddeld tot hoog	Lager (niet bedoeld voor snelle bewerkingen)
Aanpassen van data	Alleen het gewijzigde blok wordt overschreven	Specifiek deel of hele bestand wordt bijgewerkt	Volledig object moet opnieuw worden weggeschreven
Schaalbaarheid	Beperkter (gekoppeld aan één server/VM)	Goed, maar wordt trager bij miljoenen mappen	Vrijwel onbeperkt (petabytes en meer)
Toegang / Protocol	iSCSI, Fibre Channel, NVMe	SMB, NFS	HTTP/HTTPS (REST API's)


1. Block Storage (Snelheid en prestaties)

• Hoe het werkt: Data wordt opgeknipt in blokken van gelijke grootte. Het besturingssysteem ziet deze blokken als een fysieke harde schijf.
• Voordeel: Omdat alleen aangepaste blokken worden overschreven, is dit veruit de snelste optie.
• Wanneer kiezen: Databases met veel lees- en schrijfacties, virtuele machines (VM's) en bedrijfskritische applicaties.

2. File Storage (Eenvoud en samenwerking)

• Hoe het werkt: Data wordt opgeslagen als complete bestanden in een boomstructuur van mappen, net zoals op een computer of NAS.
• Voordeel: Gebruikers en applicaties kunnen bestanden makkelijk terugvinden, openen en tegelijkertijd delen via netwerkprotocollen.
• Wanneer kiezen: Gedeelde netwerkschijven binnen bedrijven, kantoorbestanden, thuisdirectories en lokale bestandsservers.

3. Object Storage (Schaalbaarheid en archief)

• Hoe het werkt: Elk bestand wordt een 'object' dat bestaat uit de data zelf, een unieke ID en uitgebreide metadata. Alle objecten staan in één grote, platte opslagruimte (zoals Amazon S3).
• Voordeel: Enorm schaalbaar en relatief goedkoop voor grote hoeveelheden ongestructureerde data. Je zoekt data op basis van metadata in plaats van een mappenpad.
• Wanneer kiezen: Back-ups, archieven, media-opslag (foto's, video's, audio), big data-analyse en cloud-native applicaties.

Welke moet je kiezen?

• Kies Block Storage als maximale snelheid en lage latency vereist zijn (bijv. voor een database).
• Kies File Storage als je een herkenbare mappenstructuur wilt om bestanden makkelijk met collega's of systemen te delen.
• Kies Object Storage als je enorme hoeveelheden statische data goedkoop en schaalbaar wilt opslaan.


## Wanneer kies je block storage

Je kiest voor block storage wanneer maximale snelheid, extreem lage vertraging (latency) en directe toegang tot losse datablokken cruciaal zijn voor je applicatie. Omdat systemen alleen de gewijzigde blokken overschrijven in plaats van een heel bestand, presteert het veruit het best bij intensieve lees- en schrijfacties.

Belangrijkste scenario's voor Block Storage

• Databases met veel transacties: Relationele databases (zoals MySQL, PostgreSQL, Oracle of Microsoft SQL Server) en NoSQL-databases doen continu kleine aanpassingen. Block storage voorkomt vertragingen bij het bijwerken van individuele records.
• Virtuele machines (VM's) en opstartschijven: Het besturingssysteem van een cloudserver of VM (zoals Windows of Linux) draait op block storage (bijvoorbeeld AWS EBS of Azure Managed Disks), omdat het zich gedraagt als een razendsnelle lokale harde schijf.
• Bedrijfskritische applicaties (ERP / CRM): Systemen zoals SAP of zware e-commerceplatforms die direct en zonder haperingen data moeten verwerken.
• Containers met blijvende data (Stateful containers): Wanneer Kubernetes-containers data moeten bewaren die snel toegankelijk blijft, ook als een container opnieuw opstart.
• Virtual Desktop Infrastructure (VDI): Virtuele werkplekken op afstand hebben snelle schijftoegang nodig om voor de gebruiker soepel te blijven aanvoelen.

Wanneer kies je het beter NIET?

• Als meerdere servers tegelijk dezelfde bestanden moeten bewerken: Block storage wordt meestal aan één server tegelijk gekoppeld (tenzij je complexe cluster-software gebruikt); hiervoor is file storage geschikter.
• Voor goedkope massa-opslag of archieven: Voor back-ups, video's of statische bestanden is object storage veel voordeliger en makkelijker schaalbaar.


## Wanneer kies je de andere

Je kiest voor file storage wanneer mensen of meerdere systemen tegelijk dezelfde bestanden moeten delen in een herkenbare mappenstructuur, en voor object storage wanneer je enorme hoeveelheden ongestructureerde data goedkoop en vrijwel onbeperkt wilt bewaren.

Wanneer kies je File Storage?

File storage is de beste keuze als samenwerking, toegankelijkheid en een standaard mappenstructuur belangrijker zijn dan extreme snelheid.
• Gedeelde bedrijfsschijven (NAS / Bestandsservers): Wanneer collega's op kantoor samenwerken in Word-, Excel- of PDF-documenten en bestanden netjes in mappen en submappen willen ordenen.
• Gedeelde opslag voor meerdere servers tegelijk: Als meerdere webservers of applicaties tegelijkertijd lees- en schrijftoegang nodig hebben tot dezelfde map (bijvoorbeeld voor gedeelde configuraties of uploads op een website).
• Media- en contentproductie: Teams die vanuit verschillende werkstations grote videoprojecten of grafische ontwerpen openen en bewerken via een snel lokaal netwerk (via protocollen zoals SMB of NFS).
• Bestaande (legacy) applicaties: Oudere software die ontworpen is om direct naar een lokaal bestandssysteem met schijfletters of mappenpaden te schrijven.

Wanneer kies je Object Storage?

Object storage kies je voor maximale schaalbaarheid, lage kosten per gigabyte en uitgebreide metadata bij data die niet continu aangepast hoeft te worden.
• Back-ups en disaster recovery: Ideale en betaalbare plek om grote systeemkopieën en archieven veilig weg te schrijven.
• Media en statische webcontent: Het opslaan van miljoenen foto's, video's, audiobestanden en downloads voor websites of streamingdiensten (zoals via Amazon S3 of Azure Blob Storage).
• Big Data, AI en data lakes: Het verzamelen van enorme bergen ruwe data, logbestanden en sensordata (IoT) voor analyse of het trainen van AI-modellen, waarbij uitgebreide metadata helpt om data snel te filteren.
• Cloud-native applicaties: Moderne apps die data niet via mappen benaderen, maar rechtstreeks ophalen en wegschrijven via internetprotocollen (HTTP/REST API's).
• Langdurige archivering en compliance: Gegevens die jarenlang bewaard moeten blijven voor wetgeving (zoals medische dossiers of financiële administratie) zonder dat je er dagelijks bij hoeft.

Snelle keuzehulp

• Veel kleine aanpassingen & maximale snelheid? → Block storage
• Samenwerken in mappen & gedeelde toegang? → File storage
• Enorme hoeveelheden data, media of back-ups? → Object storage

## De EBS-volumetypes (gp3, gp2, io2, st1, sc1): verschillen, limieten, prijs in Frankfurt. Waarom kies je vandaag bijna altijd gp3?


1. Vergelijking: Verschillen, Limieten en Prijzen in Frankfurt (eu-central-1)

De exacte limieten en prijzen van de vijf belangrijkste Amazon EBS volumetypes in de regio EU (Frankfurt):

Kenmerk	gp3 (General Purpose SSD)	gp2 (General Purpose SSD)	io2 Block Express (Provisioned IOPS SSD)	st1 (Throughput Optimized HDD)	sc1 (Cold HDD)
Techniek	SSD (nieuwste generatie)	SSD (oudere generatie)	SSD (extreme prestaties)	HDD (magnetisch)	HDD (magnetisch)
Capaciteit	1 GiB – 64 TiB	1 GiB – 16 TiB	4 GiB – 64 TiB	125 GiB – 16 TiB	125 GiB – 16 TiB
Max. IOPS / volume	80.000 IOPS	16.000 IOPS	256.000 IOPS	500 IOPS	250 IOPS
Max. Throughput	2.000 MiB/s	250 MiB/s	4.000 MiB/s	500 MiB/s	250 MiB/s
Baseline (inbegrepen)	3.000 IOPS & 125 MiB/s	3 IOPS per GiB (min. 100)	Geen (alles apart betalen)	40 MB/s per TiB (burst 250)	12 MB/s per TiB (burst 80)
Duurzaamheid	99,8% – 99,9%	99,8% – 99,9%	99,999% (5-nines)	99,8% – 99,9%	99,8% – 99,9%
Boot-volume mogelijk?	Ja	Ja	Ja	Nee	Nee
Prijs opslag (Frankfurt)	$0,095 / GB-mnd	$0,119 / GB-mnd	$0,149 / GB-mnd	$0,054 / GB-mnd	$0,018 / GB-mnd
Prijs extra snelheid (Frankfurt)	+$0,006 / IOPS (boven 3.000)
+$0,048 / MiB/s (boven 125)	Inbegrepen in opslagprijs	+$0,078 / IOPS (tot 32k)
+$0,055 / IOPS (32k–64k)
+$0,038 / IOPS (>64k)	Inbegrepen in opslagprijs	Inbegrepen in opslagprijs

(Opmerking: In Frankfurt liggen de prijzen door regionale infrastructuurkosten zo'n 19% hoger dan het Amerikaanse basistarief van $0,08/GB voor gp3).

2. Waarom kies je vandaag bijna altijd gp3?

Vroeger was gp2 de standaard, maar sinds de introductie (en de grote limietverhoging naar 80.000 IOPS) is gp3 op elk vlak de betere standaardkeuze:
• Direct 20% goedkoper: Voor exact dezelfde SSD-opslag betaal je in Frankfurt $0,095/GB in plaats van $0,119/GB bij gp2.
• Geen "opslag kopen voor snelheid": Bij gp2 krijg je 3 IOPS per GB. Had je vroeger een kleine database van 100 GB die 3.000 IOPS nodig had, dan moest je verplicht een dure gp2-schijf van 1.000 GB kopen. Bij gp3 krijg je op een schijf van 20 GB of 100 GB direct 3.000 IOPS gratis.
• Onafhankelijk schalen: Heb je plots meer doorvoersnelheid (MB/s) of IOPS nodig, maar geen extra opslagruimte? Dan schroef je enkel de IOPS of throughput omhoog zonder je schijf te vergroten.
• Voorspelbare prestaties zonder "burst credits": Kleine gp2-volumes werken met een kredietsysteem: zodra je krediet op is, stort de snelheid in. gp3 levert continu zijn geprovisioneerde snelheid.
• Zero-downtime migratie: Bestaande gp2-volumes kun je in de AWS Console of via de CLI met één klik omzetten naar gp3 terwijl je server gewoon blijft draaien.

3. Wanneer kies je NIET voor gp3?

De andere types bestaan enkel nog voor zeer specifieke scenario's:
• Kies io2 Block Express alleen als:
	• Je meer dan 80.000 IOPS of meer dan 2.000 MiB/s op één volume nodig hebt.
	• Je applicatie sub-milliseconde latency eist (zoals enorme SAP HANA-, Oracle- of SQL Server-clusters).
	• Je 99,999% duurzaamheid nodig hebt (100x betrouwbaarder tegen schijffalen dan gp3) of EBS Multi-Attach gebruikt om één schijf aan meerdere EC2-instances tegelijk te koppelen.
• Kies st1 (Throughput HDD) alleen als:
	• Je grote, sequentiële datastromen verwerkt (zoals Kafka, datawarehouses of zware logverwerking) waarbij doorvoersnelheid (MB/s) belangrijk is, maar IOPS niet, en je minstens enkele terabytes nodig hebt.
• Kies sc1 (Cold HDD) alleen als:
	• Je grote hoeveelheden zelden opgevraagde data op een EC2-schijf wilt bewaren tegen de laagste prijs ($0,018/GB). (Tip: Vaak is Amazon S3 in de praktijk nog goedkoper en makkelijker voor koude data).
• Kies gp2: Nooit meer voor nieuwe projecten; het bestaat enkel nog voor oudere (legacy) omgevingen.


## EBS en Availability Zones, snapshots, encryptie, een volume vergroten. Wat is een instance store en wanneer ben je die data kwijt?

Amazon EBS-volumes zijn strikt gekoppeld aan één specifieke Availability Zone (AZ), maar via snapshots maak je ze verplaatsbaar tussen zones en regio's, kun je ze achteraf versleutelen, en je kunt een volume live vergroten zonder downtime. Een Instance Store is daarentegen fysieke, tijdelijke opslag op de hostserver zelf waarvan je de data direct kwijtraakt zodra de EC2-instance stopt of crasht.

1. EBS en Availability Zones (AZ's)

• Gebonden aan één AZ: Een EBS-volume wordt aangemaakt in één specifieke Availability Zone (bijv. eu-central-1a). Je kunt het alleen koppelen aan een EC2-instance in diezelfde AZ.
• Hoge beschikbaarheid binnen de AZ: Binnen die ene AZ wordt je data automatisch gerepliceerd over meerdere servers om hardwarestoringen op te vangen.
• Verplaatsen naar een andere AZ: Wil je het volume verplaatsen naar eu-central-1b? Maak eerst een snapshot van het volume en herstel (restore) die snapshot vervolgens als een nieuw EBS-volume in de gewenste AZ.

2. EBS Snapshots

Een snapshot is een point-in-time back-up van je EBS-volume die automatisch wordt opgeslagen op Amazon S3 (in een door AWS beheerde bucket, dus niet zichtbaar in je eigen S3-lijst).
• Incrementeel: De eerste snapshot kopieert het volledige volume. Elke volgende snapshot slaat alleen de gewijzigde datablokken op sinds de vorige snapshot, wat flink bespaart op opslagkosten en tijd.
• Verwijderen van oude snapshots: Omdat AWS achter de schermen verwijzingen naar ongewijzigde blokken beheert, kun je een tussenliggende snapshot veilig verwijderen zonder dat je herstelpunt verloren gaat.
• Regionaal beschikbaar: Een snapshot is beschikbaar in de gehele AWS-regio (dus in alle AZ's van bijvoorbeeld Frankfurt) en kan ook worden gekopieerd naar een andere regio voor disaster recovery.

3. EBS Encryptie

Met EBS-encryptie wordt je data beveiligd met AES-256 via AWS KMS (Key Management Service), zonder merkbare impact op de snelheid.
• Wat wordt versleuteld? Data op het volume zelf (data at rest), het dataverkeer tussen het EBS-volume en de EC2-instance (data in transit), alle snapshots van dat volume, en nieuwe volumes die je uit die snapshots herstelt.
• Bestaand onversleuteld volume versleutelen: Je kunt encryptie niet direct aanvinken op een bestaand onversleuteld volume. De standaardmethode is:
	1. Maak een snapshot van het onversleutelde volume.
	2. Kopieer de snapshot en vink tijdens het kopiëren Encrypt aan (of maak direct een versleuteld volume aan vanuit de snapshot).
	3. Koppel het nieuwe, versleutelde volume aan je EC2-instance.
• (Tip: Je kunt op account- en regioniveau "Always encrypt new EBS volumes" aanzetten, zodat elk nieuw volume automatisch versleuteld wordt).

4. Een EBS-volume vergroten (Zonder downtime)

Met Elastic Volumes kun je een EBS-volume vergroten (of het type/IOPS aanpassen) terwijl je server gewoon online blijft. (Verkleinen is niet mogelijk).
1. In AWS (Console / CLI / Terraform): Pas de grootte van het volume aan (bijv. van 50 GB naar 100 GB). Wacht tot de status op optimizing of completed staat.
2. In het besturingssysteem (OS): AWS maakt alleen de virtuele schijf groter; je besturingssysteem moet de nieuwe ruimte nog toewijzen aan de partitie en het bestandssysteem:
	• Linux: Gebruik lsblk om de schijfnaam te zien, vergroot de partitie met sudo growpart /dev/nvme0n1 1 en breid het bestandssysteem uit met sudo resize2fs /dev/nvme0n1p1 (ext4) of sudo xfs_growfs -d / (XFS).
	• Windows: Open Disk Management, klik met de rechtermuisknop op de partitie en kies Extend Volume.

5. Wat is een EC2 Instance Store en wanneer ben je de data kwijt?

Een Instance Store (ephemeral storage) bestaat uit fysieke NVMe-SSD's of harde schijven die rechtstreeks in de fysieke hostserver zitten waarop jouw EC2-instance draait.
• Voordelen: Extreem lage latency, enorme IOPS-snelheden en vaak inbegrepen in de uurprijs van specifieke EC2-instancetypes (zoals i3, d3 of m5d).
• Nadeel: Het is tijdelijke (ephemeral) opslag.

Wanneer ben je de data op een Instance Store definitief kwijt?

Je verliest alle data op een Instance Store zodra de koppeling met de fysieke hostserver wordt verbroken:
1. Stoppen (Stop) van de instance: Als je een EC2-instance stopt, verhuist AWS je virtuele machine bij de volgende start naar een andere fysieke server. De oude schijf wordt gewist.
2. Hibernation (Sluimerstand): Ook bij sluimerstand wordt de instance-store-data gewist.
3. Termineren (Terminate) van de instance: De instance en schijf worden definitief verwijderd.
4. Hardwarestoring van de onderliggende fysieke schijf: Als de fysieke SSD in het datacenter kapotgaat, is de data weg (er is geen automatische replicatie zoals bij EBS).
(Let op: Bij een simpele Reboot (herstart) binnen het besturingssysteem blijft de EC2-instance op dezelfde fysieke host draaien en blijft de data op de Instance Store wél bewaard).
Wanneer gebruik je een Instance Store dan wel?
Voor tijdelijke data die snel verwerkt moet worden en elders veilig staat of eenvoudig opnieuw berekend kan worden: denk aan caches, buffers, scratch-ruimte, tijdelijke logverwerking of gedistribueerde systemen die zelf hun data repliceren over meerdere nodes (zoals Cassandra of Hadoop).