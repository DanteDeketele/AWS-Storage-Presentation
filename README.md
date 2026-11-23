# Block storage & Amazon EBS: interactieve presentatie + live demo

De presentatie is een interactieve slide deck die een week lang online staat.
Een Lambda-functie serveert de slides. Op de demo-slides start elke **▶ Run**-knop
een echte AWS-actie in eu-central-1, en de uitvoer verschijnt live op de slide.

```
Browser ──HTTPS──▶ Lambda Function URL ──┬─▶ slides (HTML/CSS/JS)
                                         ├─▶ /api/*  → EC2 / EBS API's + SSM Run Command
EventBridge (elke 5 min) ──▶ zelfde Lambda ─▶ reaper: verwijdert demo-resources ouder dan 20 min
```

## Kosten: wat draait er permanent?

| Resource | Permanent? | Kost voor een week |
|---|---|---|
| Lambda + Function URL (slides + API) | ja | ≈ $0 (gratis Lambda-quota) |
| EventBridge-regel (reaper, elke 5 min) | ja | $0 |
| CloudWatch Logs (7 dagen bewaard) | ja | ≈ $0 |
| IAM-rollen, security group | ja | $0 |
| Demo-EC2 `t3.micro` + publiek IPv4 + 8 GB gp3-root | **enkel tijdens de demo** | ≈ $0,006 per demo van 20 min |
| Demo-volume gp3 5→10 GB + snapshot | **enkel tijdens de demo** | < $0,001 per demo |

Er is geen NAT gateway, load balancer, Elastic IP of webserver-EC2. We gebruiken de default VPC.

## Hoe wordt alles opgeruimd?

Alles wat de demo aanmaakt krijgt de tag `Project=ebs-demo-live`. Er zijn vijf vangnetten:

1. **Nieuwe demo**: stap 1 (*instance starten*) ruimt eerst alles van een vorige demo op.
2. **Demo verlaten**: zodra je van een demo-slide naar een gewone slide gaat, wordt alles verwijderd.
3. **Inactief**: na 10 minuten zonder interactie op een demo-slide.
4. **Tab sluiten**: de browser stuurt een cleanup-beacon.
5. **Server-reaper**: elke 5 minuten verwijdert de Lambda alles wat ouder is dan 20 minuten,
   ook als de browser gecrasht is. Daarnaast zet de instance zichzelf na 30 minuten uit
   (`shutdown -h +30`, met shutdown-gedrag *terminate*), en de volumes hebben `DeleteOnTermination`.

De Lambda mag enkel `t3.micro` starten, enkel gp3-volumes maken, en enkel resources
met de demo-tag wijzigen of verwijderen.

## Opzetten (doe je zelf)

Je hebt nodig: AWS CLI met credentials voor het Howest-account, en Terraform ≥ 1.5.

```powershell
cd terraform
terraform init
terraform apply
terraform output url                   # publieke link voor de klas (kijkmodus)
terraform output -raw presenter_url    # link voor jezelf, met de demo-sleutel
```

- **Kijkmodus** (`url`): iedereen kan de slides bekijken. Run-knoppen werken enkel met de demo-sleutel.
- **Presenter** (`presenter_url`): de sleutel wordt in je browser onthouden en uit de adresbalk gehaald.
  Je kunt hem ook instellen via 🔑 rechtsonder.

Na een wijziging aan `app/` volstaat opnieuw `terraform apply`.

## Presenteren

| Toets | Actie |
|---|---|
| `→` / spatie | volgende punt of slide |
| `←` | vorige |
| `F` | volledig scherm |
| `P` | PDF-export |

Interactief: storage-kaarten (klik), schema in stappen (AWS-groepsconventies voor Cloud, Region en AZ), gp2/gp3-calculator, instance-store-simulator, live demo met Run-knoppen.

**PDF**: druk `P` → *Opslaan als PDF* → marges *Geen* → **Achtergrondafbeeldingen** aan.
Elke slide komt op een eigen pagina (1600×900).

## Demo-flow (slides 13–18)

1. Instance starten → wacht tot de statusbalk `SSM Online` toont (± 1 min)
2. Volume maken + koppelen → `lsblk`
3. `mkfs -t xfs` → mount op `/data` + testbestand
4. `modify-volume --size 10` → `xfs_growfs` → testbestand nog steeds aanwezig
5. Snapshot
6. Opruimen

De statusbalk onderaan toont live de instance, het volume (incl. modificatie-state), de snapshots,
hoe lang het nog duurt tot de automatische verwijdering, en de kost tot nu toe.

Voor **vraag 2** van de quiz: kopieer de terminal-uitvoer van de demo-slides.

## Afbreken na de week

```powershell
cd terraform
terraform destroy
```

Controleer daarna of er niets is achtergebleven:

```powershell
aws ec2 describe-volumes --region eu-central-1 --filters Name=tag:Project,Values=ebs-demo-live --query "Volumes[].VolumeId"
```

```powershell
aws ec2 describe-snapshots --region eu-central-1 --owner-ids self --filters Name=tag:Project,Values=ebs-demo-live --query "Snapshots[].SnapshotId"
```

## Bestanden

- `app/app.py`: Lambda (slides serveren, demo-API, reaper)
- `app/static/`: slide deck (`index.html`, `style.css`, `deck.js`, `demo.js`)
- `app/static/icons/`: officiële AWS Architecture Icons (release 07/2026, aws.amazon.com/architecture/icons)
- `terraform/main.tf`: alle infrastructuur
- `presentation.md`: verhaallijn + gefactcheckte inhoud
- `research.md`: ruwe onderzoeksnotities (bevat nog fouten, zie de factcheck in presentation.md)
