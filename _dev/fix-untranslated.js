#!/usr/bin/env node
/**
 * One-shot patch script — translates 8 homepage-visible keys
 * that were left as English fallback across 17 non-en/non-zh-TW locales.
 * Keys: index.teamvault.{desc,free,team}, index.pricing.free.feat.{5,8},
 *       index.pricing.team.feat.{3,7}, index.download.note.mac
 * After running this, re-run `node _dev/build.js` to regenerate <locale>/index.html.
 */
const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'i18n');

const KEYS = [
  'index.teamvault.desc',
  'index.teamvault.free',
  'index.teamvault.team',
  'index.pricing.free.feat.5',
  'index.pricing.free.feat.8',
  'index.pricing.team.feat.3',
  'index.pricing.team.feat.7',
  'index.download.note.mac',
];

const T = {
  'zh-CN': {
    'index.teamvault.desc': '团队保管库采用「1 个正本 + 1 个共享镜像」拓扑：正本是项目版本的真实来源（NAS、共享文件夹或外接硬盘任选其一）；共享镜像是从正本同步的完整快照，供团队任何成员快速获取最新版。每位成员另有自己的工作副本。数据形式可选标准模式（直接浏览和编辑文件）或保护模式（防止破坏性历史变更）。',
    'index.teamvault.free': '免费版：1 个正本 + 1 个共享镜像，完全自行管理。无需审批，无冷却期。',
    'index.teamvault.team': '团队版（规划中）：同样的 1 个正本 + 1 个共享镜像拓扑，加上成员管理、共享镜像位置治理（管理员审批把关、变更速率节流，避免位置被随意更改干扰团队）、冲突检测和团队活动日志。',
    'index.pricing.free.feat.5': '本地与 NAS 存储（标准或保护模式）',
    'index.pricing.free.feat.8': '1 个正本 + 1 个共享镜像 + 无限正式版发布',
    'index.pricing.team.feat.3': '管理员保管库面板与位置申请（规划中）',
    'index.pricing.team.feat.7': '共享镜像治理：管理员把关，防止误改正本（规划中）',
    'index.download.note.mac': '仅支持 Apple Silicon',
  },
  'ja': {
    'index.teamvault.desc': 'チームボールトは「1 つの Canonical + 1 つの Shared Mirror」のトポロジを採用しています。Canonical はプロジェクトバージョンの正本（NAS、共有フォルダ、または外付けドライブのいずれか一つ）；Shared Mirror は Canonical から同期されたフルスナップショットで、チームメンバーが最新版をすばやく取得できます。各メンバーは自分のワークコピーも保持します。データ形式は、標準モード（ファイルを直接閲覧・編集）または保護モード（破壊的な履歴変更を防止）から選択できます。',
    'index.teamvault.free': '無料版：1 つの Canonical + 1 つの Shared Mirror を完全に自己管理。承認不要、クールダウンなし。',
    'index.teamvault.team': 'チームプラン（予定）：同じ 1 つの Canonical + 1 つの Shared Mirror トポロジに加え、メンバー管理、Shared Mirror の場所のガバナンス（管理者承認による把握と変更レート制限により、場所が不用意に変更されてチームに支障をきたすのを防ぎます）、競合検出、チームアクティビティログを提供。',
    'index.pricing.free.feat.5': 'ローカルおよび NAS ストレージ（標準モードまたは保護モード）',
    'index.pricing.free.feat.8': '1 つの Canonical + 1 つの Shared Mirror + 無制限のリリース',
    'index.pricing.team.feat.3': '管理者ボールトダッシュボードと場所申請（予定）',
    'index.pricing.team.feat.7': 'Shared Mirror ガバナンス：管理者によるゲートキーピング、誤った Canonical 変更を防止（予定）',
    'index.download.note.mac': 'Apple Silicon のみ対応',
  },
  'ko': {
    'index.teamvault.desc': '팀 볼트는 "1개의 Canonical + 1개의 Shared Mirror" 토폴로지를 채택합니다. Canonical은 프로젝트 버전의 단일 진실 공급원입니다(NAS, 공유 폴더 또는 외장 드라이브 중 하나). Shared Mirror는 Canonical에서 동기화된 전체 스냅샷으로, 팀원 누구나 빠르게 최신 버전을 받을 수 있습니다. 각 멤버는 자신의 작업 사본도 보유합니다. 데이터 형식은 표준 모드(파일 직접 탐색 및 편집) 또는 보호 모드(파괴적인 히스토리 변경 방지) 중에서 선택할 수 있습니다.',
    'index.teamvault.free': '무료: 1개의 Canonical + 1개의 Shared Mirror, 완전한 자가 관리. 승인 불필요, 쿨다운 없음.',
    'index.teamvault.team': '팀 플랜(예정): 동일한 1개의 Canonical + 1개의 Shared Mirror 토폴로지에 더해 멤버 관리, Shared Mirror 위치 거버넌스(관리자 승인 게이트키핑 및 변경률 제한으로 위치가 부주의하게 변경되어 팀에 지장을 주는 것을 방지), 충돌 감지 및 팀 활동 로그를 제공합니다.',
    'index.pricing.free.feat.5': '로컬 및 NAS 스토리지(표준 또는 보호 모드)',
    'index.pricing.free.feat.8': '1개의 Canonical + 1개의 Shared Mirror + 무제한 릴리스',
    'index.pricing.team.feat.3': '관리자 볼트 대시보드 및 위치 요청 (예정)',
    'index.pricing.team.feat.7': 'Shared Mirror 거버넌스: 관리자 게이트키핑, 우발적인 Canonical 변경 방지 (예정)',
    'index.download.note.mac': 'Apple Silicon 전용',
  },
  'de': {
    'index.teamvault.desc': 'Team Vault verwendet eine „1 Canonical + 1 Shared Mirror"-Topologie: Der Canonical ist die maßgebliche Quelle für Projektversionen (NAS, freigegebener Ordner oder externes Laufwerk); der Shared Mirror ist ein vollständiger Snapshot, der vom Canonical synchronisiert wird, damit jedes Teammitglied schnell die neueste Version erhält. Jedes Mitglied hat zusätzlich seine eigene Arbeitskopie. Das Datenformat kann der Standardmodus (Dateien direkt durchsuchen und bearbeiten) oder der geschützte Modus (verhindert zerstörerische Verlaufsänderungen) sein.',
    'index.teamvault.free': 'Kostenlos: 1 Canonical + 1 Shared Mirror, vollständig selbst verwaltet. Keine Freigabe erforderlich, keine Wartezeiten.',
    'index.teamvault.team': 'Team-Tarif (geplant): Dieselbe 1 Canonical + 1 Shared Mirror-Topologie, plus Mitgliederverwaltung, Shared-Mirror-Standort-Governance (Admin-Freigabe als Kontrollinstanz und Drosselung der Änderungsrate, damit der Standort nicht leichtfertig geändert wird und das Team stört), Konflikterkennung und Team-Aktivitätsprotokolle.',
    'index.pricing.free.feat.5': 'Lokaler & NAS-Speicher (Standard- oder geschützter Modus)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + unbegrenzte Releases',
    'index.pricing.team.feat.3': 'Admin-Vault-Dashboard mit Standort-Anfragen (geplant)',
    'index.pricing.team.feat.7': 'Shared-Mirror-Governance: Admin-Kontrolle, verhindert versehentliche Canonical-Änderungen (geplant)',
    'index.download.note.mac': 'Nur Apple Silicon',
  },
  'fr': {
    'index.teamvault.desc': 'Team Vault utilise une topologie « 1 Canonical + 1 Shared Mirror » : le Canonical est la source de vérité pour les versions du projet (NAS, dossier partagé ou disque externe) ; le Shared Mirror est un instantané complet synchronisé depuis le Canonical afin que chaque membre de l\'équipe puisse rapidement récupérer la dernière version. Chaque membre dispose également de sa propre copie de travail. Le format des données peut être en mode Standard (parcourir et modifier les fichiers directement) ou en mode Protégé (empêcher les modifications destructrices de l\'historique).',
    'index.teamvault.free': 'Gratuit : 1 Canonical + 1 Shared Mirror, entièrement autogéré. Aucune approbation nécessaire, aucun délai d\'attente.',
    'index.teamvault.team': 'Plan Équipe (prévu) : même topologie 1 Canonical + 1 Shared Mirror, plus la gestion des membres, la gouvernance de l\'emplacement du Shared Mirror (contrôle par approbation administrateur et limitation du taux de changement, afin que l\'emplacement ne soit pas modifié à la légère au détriment de l\'équipe), la détection de conflits et les journaux d\'activité de l\'équipe.',
    'index.pricing.free.feat.5': 'Stockage local et NAS (mode Standard ou Protégé)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + Releases illimitées',
    'index.pricing.team.feat.3': 'Tableau de bord admin du coffre avec demandes d\'emplacement (prévu)',
    'index.pricing.team.feat.7': 'Gouvernance Shared Mirror : contrôle d\'accès par admin, empêche les modifications accidentelles du Canonical (prévu)',
    'index.download.note.mac': 'Apple Silicon uniquement',
  },
  'es': {
    'index.teamvault.desc': 'Team Vault utiliza una topología «1 Canonical + 1 Shared Mirror»: el Canonical es la fuente única de verdad para las versiones del proyecto (NAS, carpeta compartida o disco externo); el Shared Mirror es una instantánea completa sincronizada desde el Canonical para que cualquier miembro del equipo pueda obtener rápidamente la versión más reciente. Cada miembro también tiene su propia copia de trabajo. El formato de datos puede ser modo Estándar (examinar y editar archivos directamente) o modo Protegido (impedir cambios destructivos del historial).',
    'index.teamvault.free': 'Gratis: 1 Canonical + 1 Shared Mirror, totalmente autogestionado. Sin aprobación requerida, sin tiempos de espera.',
    'index.teamvault.team': 'Plan Equipo (previsto): la misma topología 1 Canonical + 1 Shared Mirror, además de gestión de miembros, gobernanza de la ubicación del Shared Mirror (control mediante aprobación del administrador y limitación de la tasa de cambio, para que la ubicación no se altere a la ligera y perjudique al equipo), detección de conflictos y registros de actividad del equipo.',
    'index.pricing.free.feat.5': 'Almacenamiento local y NAS (modo Estándar o Protegido)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + Releases ilimitadas',
    'index.pricing.team.feat.3': 'Panel de administrador del vault con solicitudes de ubicación (previsto)',
    'index.pricing.team.feat.7': 'Gobernanza de Shared Mirror: control por administrador, evita cambios accidentales en el Canonical (previsto)',
    'index.download.note.mac': 'Solo Apple Silicon',
  },
  'it': {
    'index.teamvault.desc': 'Team Vault utilizza una topologia «1 Canonical + 1 Shared Mirror»: il Canonical è la fonte di verità per le versioni del progetto (NAS, cartella condivisa o disco esterno); il Shared Mirror è uno snapshot completo sincronizzato dal Canonical, in modo che qualsiasi membro del team possa ottenere rapidamente la versione più recente. Ciascun membro ha anche una propria copia di lavoro. Il formato dei dati può essere modalità Standard (sfogliare e modificare i file direttamente) o modalità Protetta (impedire modifiche distruttive alla cronologia).',
    'index.teamvault.free': 'Gratis: 1 Canonical + 1 Shared Mirror, completamente autogestito. Nessuna approvazione necessaria, nessun cooldown.',
    'index.teamvault.team': 'Piano Team (previsto): stessa topologia 1 Canonical + 1 Shared Mirror, oltre alla gestione dei membri, governance della posizione dello Shared Mirror (controllo tramite approvazione amministratore e limitazione del tasso di modifica, in modo che la posizione non venga modificata con leggerezza danneggiando il team), rilevamento dei conflitti e registri delle attività del team.',
    'index.pricing.free.feat.5': 'Archiviazione locale e NAS (modalità Standard o Protetta)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + Release illimitate',
    'index.pricing.team.feat.3': 'Dashboard amministratore del vault con richieste di posizione (previsto)',
    'index.pricing.team.feat.7': 'Governance Shared Mirror: controllo amministratore, previene modifiche accidentali al Canonical (previsto)',
    'index.download.note.mac': 'Solo Apple Silicon',
  },
  'pt': {
    'index.teamvault.desc': 'O Team Vault utiliza uma topologia "1 Canonical + 1 Shared Mirror": o Canonical é a fonte da verdade para as versões do projeto (NAS, pasta compartilhada ou disco externo); o Shared Mirror é um snapshot completo sincronizado a partir do Canonical, para que qualquer membro da equipe possa obter rapidamente a versão mais recente. Cada membro também tem sua própria cópia de trabalho. O formato dos dados pode ser modo Padrão (navegar e editar arquivos diretamente) ou modo Protegido (impedir alterações destrutivas no histórico).',
    'index.teamvault.free': 'Grátis: 1 Canonical + 1 Shared Mirror, totalmente autogerenciado. Sem aprovação necessária, sem cooldowns.',
    'index.teamvault.team': 'Plano Equipe (planejado): a mesma topologia 1 Canonical + 1 Shared Mirror, além de gerenciamento de membros, governança da localização do Shared Mirror (controle por aprovação do administrador e limitação da taxa de alteração, para que a localização não seja alterada descuidadamente prejudicando a equipe), detecção de conflitos e registros de atividade da equipe.',
    'index.pricing.free.feat.5': 'Armazenamento local e NAS (modo Padrão ou Protegido)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + Releases ilimitadas',
    'index.pricing.team.feat.3': 'Painel de administrador do vault com solicitações de localização (planejado)',
    'index.pricing.team.feat.7': 'Governança do Shared Mirror: controle por administrador, evita alterações acidentais no Canonical (planejado)',
    'index.download.note.mac': 'Apenas Apple Silicon',
  },
  'nl': {
    'index.teamvault.desc': 'Team Vault gebruikt een "1 Canonical + 1 Shared Mirror"-topologie: de Canonical is de bron van waarheid voor projectversies (NAS, gedeelde map of externe schijf); de Shared Mirror is een volledige snapshot die gesynchroniseerd wordt vanaf de Canonical, zodat elk teamlid snel de nieuwste versie kan ophalen. Elk lid heeft daarnaast een eigen werkkopie. Het dataformaat kan de Standaardmodus zijn (bestanden direct bekijken en bewerken) of de Beveiligde modus (voorkomt destructieve geschiedeniswijzigingen).',
    'index.teamvault.free': 'Gratis: 1 Canonical + 1 Shared Mirror, volledig zelf beheerd. Geen goedkeuring nodig, geen cooldowns.',
    'index.teamvault.team': 'Team-abonnement (gepland): dezelfde 1 Canonical + 1 Shared Mirror-topologie, plus ledenbeheer, locatiegovernance van Shared Mirror (admin-goedkeuring als poortwachter en beperking van de wijzigingssnelheid, zodat de locatie niet achteloos wordt gewijzigd en het team verstoort), conflictdetectie en activiteitslogboeken van het team.',
    'index.pricing.free.feat.5': 'Lokale en NAS-opslag (Standaard- of Beveiligde modus)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + onbeperkte Releases',
    'index.pricing.team.feat.3': 'Beheerders-vault-dashboard met locatieaanvragen (gepland)',
    'index.pricing.team.feat.7': 'Shared Mirror-governance: admin-poortwachter, voorkomt onbedoelde Canonical-wijzigingen (gepland)',
    'index.download.note.mac': 'Alleen Apple Silicon',
  },
  'pl': {
    'index.teamvault.desc': 'Team Vault korzysta z topologii „1 Canonical + 1 Shared Mirror": Canonical jest źródłem prawdy dla wersji projektu (NAS, folder współdzielony lub dysk zewnętrzny); Shared Mirror to pełna migawka synchronizowana z Canonical, dzięki czemu każdy członek zespołu może szybko uzyskać najnowszą wersję. Każdy członek ma także własną kopię roboczą. Format danych może być w trybie Standardowym (przeglądanie i edycja plików bezpośrednio) lub w trybie Chronionym (zapobieganie destrukcyjnym zmianom historii).',
    'index.teamvault.free': 'Darmowy: 1 Canonical + 1 Shared Mirror, w pełni samodzielnie zarządzane. Bez konieczności zatwierdzania, bez okresów oczekiwania.',
    'index.teamvault.team': 'Plan Zespołowy (planowany): ta sama topologia 1 Canonical + 1 Shared Mirror, dodatkowo zarządzanie członkami, zarządzanie lokalizacją Shared Mirror (zatwierdzanie przez administratora i ograniczanie częstotliwości zmian, aby lokalizacja nie była lekkomyślnie zmieniana zakłócając pracę zespołu), wykrywanie konfliktów oraz dzienniki aktywności zespołu.',
    'index.pricing.free.feat.5': 'Pamięć lokalna i NAS (tryb Standardowy lub Chroniony)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + nieograniczone wydania',
    'index.pricing.team.feat.3': 'Panel administratora vault z prośbami o lokalizację (planowane)',
    'index.pricing.team.feat.7': 'Zarządzanie Shared Mirror: kontrola administratora, zapobieganie przypadkowym zmianom Canonical (planowane)',
    'index.download.note.mac': 'Tylko Apple Silicon',
  },
  'cs': {
    'index.teamvault.desc': 'Team Vault používá topologii „1 Canonical + 1 Shared Mirror": Canonical je zdrojem pravdy pro verze projektu (NAS, sdílená složka nebo externí disk); Shared Mirror je úplný snímek synchronizovaný z Canonical, takže každý člen týmu může rychle získat nejnovější verzi. Každý člen má také vlastní pracovní kopii. Formát dat může být ve Standardním režimu (procházení a úprava souborů přímo) nebo v Chráněném režimu (zabraňuje destruktivním změnám historie).',
    'index.teamvault.free': 'Zdarma: 1 Canonical + 1 Shared Mirror, plně samostatně spravované. Bez nutnosti schvalování, bez cooldownů.',
    'index.teamvault.team': 'Týmový plán (plánovaný): stejná topologie 1 Canonical + 1 Shared Mirror, plus správa členů, správa umístění Shared Mirror (schvalovací kontrola správce a omezení rychlosti změn, aby umístění nebylo neuváženě měněno a nenarušilo tým), detekce konfliktů a protokoly aktivit týmu.',
    'index.pricing.free.feat.5': 'Lokální a NAS úložiště (Standardní nebo Chráněný režim)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + neomezené Releases',
    'index.pricing.team.feat.3': 'Administrátorský panel vault s žádostmi o umístění (plánováno)',
    'index.pricing.team.feat.7': 'Správa Shared Mirror: kontrola správce, brání náhodným změnám Canonical (plánováno)',
    'index.download.note.mac': 'Pouze Apple Silicon',
  },
  'hu': {
    'index.teamvault.desc': 'A Team Vault „1 Canonical + 1 Shared Mirror" topológiát használ: a Canonical a projektverziók igazságforrása (NAS, megosztott mappa vagy külső meghajtó); a Shared Mirror egy teljes pillanatkép, amelyet a Canonical szinkronizál, így bármely csapattag gyorsan elérheti a legújabb verziót. Minden tag rendelkezik saját munkamásolattal is. Az adatformátum lehet Standard mód (fájlok közvetlen böngészése és szerkesztése) vagy Védett mód (megakadályozza a destruktív előzményváltozásokat).',
    'index.teamvault.free': 'Ingyenes: 1 Canonical + 1 Shared Mirror, teljesen önállóan kezelhető. Nincs jóváhagyás szükséges, nincsenek várakozási idők.',
    'index.teamvault.team': 'Csapat csomag (tervezett): ugyanaz az 1 Canonical + 1 Shared Mirror topológia, plusz tagkezelés, Shared Mirror helyszín-irányítás (rendszergazdai jóváhagyási kapuőrzés és változási ütem korlátozás, hogy a helyszín ne legyen meggondolatlanul módosítva, megzavarva a csapatot), konfliktusészlelés és csapataktivitási naplók.',
    'index.pricing.free.feat.5': 'Helyi és NAS tárhely (Standard vagy Védett mód)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + korlátlan kiadás',
    'index.pricing.team.feat.3': 'Adminisztrátori vault irányítópult helyszínkérésekkel (tervezett)',
    'index.pricing.team.feat.7': 'Shared Mirror irányítás: adminisztrátori kapuőrzés, megakadályozza a véletlen Canonical módosításokat (tervezett)',
    'index.download.note.mac': 'Csak Apple Silicon',
  },
  'tr': {
    'index.teamvault.desc': 'Team Vault, "1 Canonical + 1 Shared Mirror" topolojisini kullanır: Canonical, proje sürümleri için doğruluğun kaynağıdır (NAS, paylaşılan klasör veya harici disk); Shared Mirror, Canonical\'dan senkronize edilen tam bir anlık görüntüdür, böylece herhangi bir ekip üyesi en son sürümü hızlıca alabilir. Her üyenin ayrıca kendi çalışma kopyası vardır. Veri formatı Standart mod (dosyaları doğrudan tarama ve düzenleme) veya Korumalı mod (yıkıcı geçmiş değişikliklerini önler) olabilir.',
    'index.teamvault.free': 'Ücretsiz: 1 Canonical + 1 Shared Mirror, tamamen kendi kendine yönetilebilir. Onay gerekmez, bekleme süresi yok.',
    'index.teamvault.team': 'Takım planı (planlanan): aynı 1 Canonical + 1 Shared Mirror topolojisi, ayrıca üye yönetimi, Shared Mirror konum yönetişimi (yönetici onay denetimi ve değişiklik hızı sınırlaması, böylece konum dikkatsizce değiştirilip ekibi sekteye uğratmaz), çakışma algılama ve takım etkinlik günlükleri.',
    'index.pricing.free.feat.5': 'Yerel ve NAS depolama (Standart veya Korumalı mod)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + sınırsız Sürüm',
    'index.pricing.team.feat.3': 'Konum istekleriyle yönetici vault panosu (planlandı)',
    'index.pricing.team.feat.7': 'Shared Mirror yönetişimi: yönetici denetimi, kazara Canonical değişikliklerini önler (planlandı)',
    'index.download.note.mac': 'Yalnızca Apple Silicon',
  },
  'fi': {
    'index.teamvault.desc': 'Team Vault käyttää "1 Canonical + 1 Shared Mirror" -topologiaa: Canonical on projektin versioiden tiedon lähde (NAS, jaettu kansio tai ulkoinen asema); Shared Mirror on Canonicalista synkronoitu täysi tilannevedos, joten kuka tahansa tiimin jäsen voi nopeasti hakea uusimman version. Jokaisella jäsenellä on myös oma työkopionsa. Datamuoto voi olla Standard-tila (tiedostojen suora selaaminen ja muokkaaminen) tai Suojattu tila (estää tuhoavat historiamuutokset).',
    'index.teamvault.free': 'Ilmainen: 1 Canonical + 1 Shared Mirror, täysin itse hallinnoitavissa. Ei tarvitse hyväksyntää, ei jäähdytysaikoja.',
    'index.teamvault.team': 'Tiimi-tilaus (suunnitteilla): sama 1 Canonical + 1 Shared Mirror -topologia, plus jäsenten hallinta, Shared Mirror -sijainnin hallinta (järjestelmänvalvojan hyväksyntäportti ja muutosnopeuden rajoitus, jotta sijaintia ei muuteta huolimattomasti tiimiä häiriten), konfliktien tunnistus ja tiimin toimintalokit.',
    'index.pricing.free.feat.5': 'Paikallinen ja NAS-tallennus (Standard- tai Suojattu tila)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + rajattomat julkaisut',
    'index.pricing.team.feat.3': 'Pääkäyttäjän vault-koontinäyttö sijaintipyynnöillä (suunnitteilla)',
    'index.pricing.team.feat.7': 'Shared Mirror -hallinta: pääkäyttäjän valvonta, estää tahattomat Canonical-muutokset (suunnitteilla)',
    'index.download.note.mac': 'Vain Apple Silicon',
  },
  'sv': {
    'index.teamvault.desc': 'Team Vault använder en "1 Canonical + 1 Shared Mirror"-topologi: Canonical är sanningskällan för projektversioner (NAS, delad mapp eller extern enhet); Shared Mirror är en fullständig ögonblicksbild som synkroniseras från Canonical så att alla teammedlemmar snabbt kan hämta den senaste versionen. Varje medlem har även en egen arbetskopia. Dataformatet kan vara Standardläge (bläddra och redigera filer direkt) eller Skyddat läge (förhindrar destruktiva historikändringar).',
    'index.teamvault.free': 'Gratis: 1 Canonical + 1 Shared Mirror, helt självhanterat. Inget godkännande krävs, inga avkylningsperioder.',
    'index.teamvault.team': 'Team-plan (planerad): samma 1 Canonical + 1 Shared Mirror-topologi, plus medlemshantering, platsstyrning för Shared Mirror (administratörsgodkännande som grindvakt och begränsning av ändringsfrekvens, så att platsen inte ändras vårdslöst och stör teamet), konfliktdetektering och teamaktivitetsloggar.',
    'index.pricing.free.feat.5': 'Lokal och NAS-lagring (Standardläge eller Skyddat läge)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + obegränsade Releases',
    'index.pricing.team.feat.3': 'Admin-vault-instrumentpanel med platsförfrågningar (planerat)',
    'index.pricing.team.feat.7': 'Shared Mirror-styrning: admin-grindvakt, förhindrar oavsiktliga Canonical-ändringar (planerat)',
    'index.download.note.mac': 'Endast Apple Silicon',
  },
  'no': {
    'index.teamvault.desc': 'Team Vault bruker en «1 Canonical + 1 Shared Mirror»-topologi: Canonical er sannhetskilden for prosjektversjoner (NAS, delt mappe eller ekstern disk); Shared Mirror er et fullstendig øyeblikksbilde synkronisert fra Canonical, slik at ethvert teammedlem raskt kan hente nyeste versjon. Hvert medlem har også sin egen arbeidskopi. Dataformatet kan være standardmodus (bla og redigere filer direkte) eller beskyttet modus (hindrer ødeleggende historiendringer).',
    'index.teamvault.free': 'Gratis: 1 Canonical + 1 Shared Mirror, fullt selvadministrert. Ingen godkjenning nødvendig, ingen ventetid.',
    'index.teamvault.team': 'Team-plan (planlagt): samme 1 Canonical + 1 Shared Mirror-topologi, pluss medlemshåndtering, plassstyring for Shared Mirror (admin-godkjenning som portvokter og begrensning av endringstakt, slik at plasseringen ikke endres uvøren og forstyrrer teamet), konfliktdeteksjon og teamaktivitetslogger.',
    'index.pricing.free.feat.5': 'Lokal og NAS-lagring (standard- eller beskyttet modus)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + ubegrensede Releases',
    'index.pricing.team.feat.3': 'Admin-vault-dashbord med plassforespørsler (planlagt)',
    'index.pricing.team.feat.7': 'Shared Mirror-styring: admin-portvokter, hindrer utilsiktede Canonical-endringer (planlagt)',
    'index.download.note.mac': 'Kun Apple Silicon',
  },
  'da': {
    'index.teamvault.desc': 'Team Vault bruger en "1 Canonical + 1 Shared Mirror"-topologi: Canonical er sandhedskilden for projektversioner (NAS, delt mappe eller ekstern disk); Shared Mirror er et fuldt øjebliksbillede synkroniseret fra Canonical, så ethvert teammedlem hurtigt kan hente den nyeste version. Hvert medlem har også sin egen arbejdskopi. Dataformatet kan være standardtilstand (gennemse og redigere filer direkte) eller beskyttet tilstand (forhindrer destruktive historikændringer).',
    'index.teamvault.free': 'Gratis: 1 Canonical + 1 Shared Mirror, fuldt selvstyret. Ingen godkendelse påkrævet, ingen ventetid.',
    'index.teamvault.team': 'Team-plan (planlagt): samme 1 Canonical + 1 Shared Mirror-topologi, plus medlemsstyring, placeringsstyring for Shared Mirror (admin-godkendelse som portvogter og begrænsning af ændringshastighed, så placeringen ikke ændres ubetænksomt og forstyrrer teamet), konfliktdetektion og teamaktivitetslogfiler.',
    'index.pricing.free.feat.5': 'Lokal og NAS-lagring (standard- eller beskyttet tilstand)',
    'index.pricing.free.feat.8': '1 Canonical + 1 Shared Mirror + ubegrænsede Releases',
    'index.pricing.team.feat.3': 'Admin-vault-dashboard med placeringsanmodninger (planlagt)',
    'index.pricing.team.feat.7': 'Shared Mirror-styring: admin-portvogter, forhindrer utilsigtede Canonical-ændringer (planlagt)',
    'index.download.note.mac': 'Kun Apple Silicon',
  },
};

// Escape a string for safe insertion as a JSON value (between quotes).
function jsonEscape(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

let totalChanges = 0;
Object.keys(T).forEach((locale) => {
  const filePath = path.join(I18N_DIR, locale + '.json');
  let raw = fs.readFileSync(filePath, 'utf8');
  let localeChanges = 0;
  KEYS.forEach((k) => {
    if (T[locale][k] == null) return;
    // Match `"key": "anyvalue"` (value may contain escaped quotes, no raw newlines)
    const escapedKey = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('("' + escapedKey + '":\\s*")((?:\\\\.|[^"\\\\])*)(")', '');
    if (!re.test(raw)) {
      console.warn('  [' + locale + '] key not found: ' + k);
      return;
    }
    const newVal = jsonEscape(T[locale][k]);
    raw = raw.replace(re, '$1' + newVal + '$3');
    localeChanges++;
  });
  fs.writeFileSync(filePath, raw, 'utf8');
  console.log(locale + ': ' + localeChanges + ' keys updated');
  totalChanges += localeChanges;
});
console.log('\nTotal updates: ' + totalChanges);
