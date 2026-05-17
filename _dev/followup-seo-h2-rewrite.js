#!/usr/bin/env node
/**
 * One-shot SEO H2 rewrite — 2026-05-17.
 *
 * Source of changes: av8d-levelup.com SEO/AEO scan recommendation
 * (raise 「問題式標題」+ Executive Answer scoring).
 *
 * For each of 6 H2 sections on the homepage:
 *   1. Rewrite H2 → question form
 *   2. Replace subtitle (or add `index.usecases.answer`) with an Executive
 *      Answer paragraph (80-120 zh chars / 40-60 en words).
 *
 * Updates all 19 locale JSON files under i18n/. Safe to re-run.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'i18n');

const TRANSLATIONS = {
  'zh-TW': {
    'index.features.title': '為什麼 Keeply 不只是備份工具？',
    'index.features.subtitle': '備份工具只記住「現在」的檔案；Keeply 記住每一個版本、每一條筆記、每一個你做過的決定。半年後客戶問「這個是誰決定的？」打開 Keeply 三秒就找到答案——這是備份工具給不了的能力。',
    'index.usecases.title': '誰會用 Keeply？適合什麼樣的工作？',
    'index.usecases.answer': '從專案經理、設計師、法務、學者、工程師到遠端團隊——只要工作需要長期保留版本、追蹤決定脈絡、或避免「最終版_v3」檔名混亂，Keeply 都比同步工具更合適。所有檔案放本地，由你掌控。',
    'index.howto.title': '怎麼開始用 Keeply？需要多久？',
    'index.howto.subtitle': '三步：下載安裝（30 秒）、選任何資料夾、開始保護。不需要帳號、不需要伺服器、不需要學任何指令。Windows 10+ 與 macOS Apple Silicon 都支援。改完想退回？一鍵就回去。',
    'index.compare.title': 'Keeply 跟 Dropbox / Google Drive / Git 差在哪？',
    'index.compare.subtitle': 'Dropbox 與 Google Drive 同步當下檔案、版本歷史 30 天清空；Git 給工程師用、學習門檻高。Keeply 為本地檔案重寫版本管理：所有版本永久保留、不雲端鎖定、不分工程師非工程師，下載即用。',
    'index.pricing.title': 'Keeply 多少錢？團隊要每人付費嗎？',
    'index.pricing.subtitle': '個人版永久免費，無使用期限；團隊版每月 25 美元定價（無人數上限），檔案放你家 NAS。Founding Member 599 美元一次付清拿永久授權，限量 500 名。沒有訂閱、沒有人頭費。',
    'index.download.title': '怎麼下載 Keeply？要付費嗎？',
    'index.download.subtitle': '免費下載、30 秒安裝、立即可用。Windows 10/11 與 macOS Apple Silicon 都支援。不需要信用卡、不需要試用期、不需要建立帳號。下載完打開任何資料夾，每一次儲存自動保留版本。'
  },
  'zh-CN': {
    'index.features.title': '为什么 Keeply 不只是备份工具？',
    'index.features.subtitle': '备份工具只记住「现在」的文件；Keeply 记住每一个版本、每一条笔记、每一个你做过的决定。半年后客户问「这个是谁决定的？」打开 Keeply 三秒就找到答案——这是备份工具给不了的能力。',
    'index.usecases.title': '谁会用 Keeply？适合什么样的工作？',
    'index.usecases.answer': '从项目经理、设计师、法务、学者、工程师到远端团队——只要工作需要长期保留版本、追踪决定脉络、或避免「最终版_v3」文件名混乱，Keeply 都比同步工具更合适。所有文件放本地，由你掌控。',
    'index.howto.title': '怎么开始用 Keeply？需要多久？',
    'index.howto.subtitle': '三步：下载安装（30 秒）、选任何文件夹、开始保护。不需要帐号、不需要服务器、不需要学任何指令。Windows 10+ 与 macOS Apple Silicon 都支持。改完想退回？一键就回去。',
    'index.compare.title': 'Keeply 跟 Dropbox / Google Drive / Git 差在哪？',
    'index.compare.subtitle': 'Dropbox 与 Google Drive 同步当下文件、版本历史 30 天清空；Git 给工程师用、学习门槛高。Keeply 为本地文件重写版本管理：所有版本永久保留、不云端锁定、不分工程师非工程师，下载即用。',
    'index.pricing.title': 'Keeply 多少钱？团队要每人付费吗？',
    'index.pricing.subtitle': '个人版永久免费，无使用期限；团队版每月 25 美元定价（无人数上限），文件放你家 NAS。Founding Member 599 美元一次付清拿永久授权，限量 500 名。没有订阅、没有人头费。',
    'index.download.title': '怎么下载 Keeply？要付费吗？',
    'index.download.subtitle': '免费下载、30 秒安装、立即可用。Windows 10/11 与 macOS Apple Silicon 都支持。不需要信用卡、不需要试用期、不需要建立帐号。下载完打开任何文件夹，每一次保存自动保留版本。'
  },
  'en': {
    'index.features.title': 'Why is Keeply more than a backup tool?',
    'index.features.subtitle': "Backup tools only remember the current file; Keeply remembers every version, every note, every decision you made. Six months later when a client asks \"who decided this?\" you open Keeply and find the answer in seconds — that's a capability backup tools simply cannot give you.",
    'index.usecases.title': 'Who uses Keeply, and what jobs is it built for?',
    'index.usecases.answer': "Project managers, designers, lawyers, academics, engineers, and remote teams — anyone whose work needs long-lived version history, decision context, or escape from \"final_v3\" filename chaos. Files stay on your disk under your control, never on a vendor server.",
    'index.howto.title': 'How do I start using Keeply, and how long does it take?',
    'index.howto.subtitle': 'Three steps: download and install (30 seconds), pick any folder, start protecting. No account, no server, no commands to learn. Works on Windows 10+ and macOS Apple Silicon. Want to roll back a change? One click.',
    'index.compare.title': 'How is Keeply different from Dropbox, Google Drive, or Git?',
    'index.compare.subtitle': 'Dropbox and Google Drive sync the current file and purge version history after 30 days; Git is built for engineers with a steep learning curve. Keeply rewrites version control for local files: every version kept forever, no cloud lock-in, no engineer-only barrier, install and go.',
    'index.pricing.title': 'How much does Keeply cost, and do teams pay per seat?',
    'index.pricing.subtitle': 'Individual tier is free forever with no expiry; Team plan is a flat $25/month (no seat cap) with files on your own NAS. Founding Member is a one-time $599 perpetual license, limited to 500 buyers. No subscriptions, no per-seat fees, no hidden tiers.',
    'index.download.title': 'How do I download Keeply, and is it paid?',
    'index.download.subtitle': 'Free download, 30-second install, instantly usable. Supports Windows 10/11 and macOS Apple Silicon. No credit card, no trial expiry, no account creation. After install, open any folder and every save is automatically version-tracked.'
  },
  'ja': {
    'index.features.title': 'Keeply はなぜ単なるバックアップツールではないのか？',
    'index.features.subtitle': 'バックアップツールが記憶するのは「現在」のファイルだけ。Keeply は版ごと、メモごと、決定ごとに記憶します。半年後にクライアントが「これは誰が決めたの？」と聞いてきても、Keeply を開けば3秒で答えが見つかります。',
    'index.usecases.title': 'Keeply は誰のため？どんな仕事に向いているのか？',
    'index.usecases.answer': 'プロジェクトマネージャー、デザイナー、法務、研究者、エンジニア、リモートチームまで——長期的な版管理、決定の経緯追跡、「最終版_v3」のような名前の混乱を避けたい人すべてに向いています。ファイルは常にローカルにあり、あなたが管理します。',
    'index.howto.title': 'Keeply の始め方は？何分かかる？',
    'index.howto.subtitle': '3ステップ：ダウンロードしてインストール（30秒）、フォルダを選ぶ、保護開始。アカウントもサーバーもコマンドも不要。Windows 10+ と macOS Apple Silicon に対応。元に戻したい？ワンクリックで戻ります。',
    'index.compare.title': 'Keeply は Dropbox / Google Drive / Git と何が違う？',
    'index.compare.subtitle': 'Dropbox と Google Drive は現在のファイルを同期し、版履歴は30日で消えます。Git はエンジニア向けで学習コストが高い。Keeply はローカルファイル向けに版管理を再設計：版は永久保存、クラウドロックなし、エンジニア限定でもなく、インストール即使用可能。',
    'index.pricing.title': 'Keeply の料金は？チームは1人ずつ払うの？',
    'index.pricing.subtitle': '個人版は永久無料、有効期限なし。チーム版は月額25ドル定額（人数制限なし）でファイルは自社の NAS に保存。Founding Member は一回払いの永久ライセンスで599ドル、500名限定。サブスクなし、シート課金なし。',
    'index.download.title': 'Keeply はどうやってダウンロードする？有料？',
    'index.download.subtitle': '無料ダウンロード、30秒でインストール、すぐ使えます。Windows 10/11 と macOS Apple Silicon に対応。クレジットカード不要、トライアル期限なし、アカウント作成なし。インストール後、任意のフォルダを開けば保存ごとに自動で版が残ります。'
  },
  'ko': {
    'index.features.title': 'Keeply 가 단순한 백업 도구가 아닌 이유는?',
    'index.features.subtitle': '백업 도구는 「현재」 파일만 기억합니다. Keeply 는 모든 버전, 모든 메모, 당신이 내린 모든 결정을 기억합니다. 반년 후 고객이 「이건 누가 결정한 거죠?」 라고 물어보면 Keeply 를 열어 3초 만에 답을 찾을 수 있습니다.',
    'index.usecases.title': 'Keeply 는 누가 쓰고, 어떤 일에 적합한가?',
    'index.usecases.answer': '프로젝트 매니저, 디자이너, 법무, 연구자, 엔지니어, 원격 팀까지——장기 버전 보관, 결정 맥락 추적, 「최종_v3」 파일명 혼란을 피하고 싶은 모든 사람에게 적합합니다. 모든 파일은 당신의 로컬에 있고 당신이 통제합니다.',
    'index.howto.title': 'Keeply 사용을 어떻게 시작하나요? 얼마나 걸리나요?',
    'index.howto.subtitle': '세 단계: 다운로드 후 설치(30초), 폴더 선택, 보호 시작. 계정도 서버도 명령어도 필요 없습니다. Windows 10+ 와 macOS Apple Silicon 지원. 되돌리고 싶다고요? 클릭 한 번이면 됩니다.',
    'index.compare.title': 'Keeply 는 Dropbox / Google Drive / Git 와 어떻게 다른가?',
    'index.compare.subtitle': 'Dropbox 와 Google Drive 는 현재 파일을 동기화하고 30일 후 버전 기록을 삭제합니다. Git 은 엔지니어를 위한 도구로 학습 곡선이 가파릅니다. Keeply 는 로컬 파일을 위해 버전 관리를 새로 설계했습니다: 모든 버전 영구 보관, 클라우드 종속 없음, 엔지니어 한정 없음, 설치 즉시 사용.',
    'index.pricing.title': 'Keeply 는 얼마인가요? 팀은 1인당 결제해야 하나요?',
    'index.pricing.subtitle': '개인용은 영구 무료이며 사용 기간 제한이 없습니다. 팀 플랜은 인원 제한 없이 월 25달러 정액, 파일은 자체 NAS 에 보관합니다. Founding Member 는 1회 결제 영구 라이선스로 599달러, 500명 한정. 구독 없음, 시트 비용 없음.',
    'index.download.title': 'Keeply 는 어떻게 다운로드하나요? 유료인가요?',
    'index.download.subtitle': '무료 다운로드, 30초 설치, 즉시 사용. Windows 10/11 과 macOS Apple Silicon 지원. 신용카드 불필요, 평가판 만료 없음, 계정 생성 없음. 설치 후 아무 폴더나 열면 저장할 때마다 자동으로 버전이 보관됩니다.'
  },
  'it': {
    'index.features.title': 'Perché Keeply non è solo uno strumento di backup?',
    'index.features.subtitle': 'Gli strumenti di backup ricordano solo il file "attuale"; Keeply ricorda ogni versione, ogni nota, ogni decisione che hai preso. Sei mesi dopo, quando un cliente chiede "chi l\'ha deciso?", apri Keeply e trovi la risposta in pochi secondi — una capacità che i backup non possono offrirti.',
    'index.usecases.title': 'Chi usa Keeply e per quali lavori è pensato?',
    'index.usecases.answer': 'Project manager, designer, legali, accademici, ingegneri e team remoti — chiunque abbia bisogno di una cronologia delle versioni a lungo termine, del contesto delle decisioni o di fuggire dal caos dei nomi "final_v3". I file restano sul tuo disco, sotto il tuo controllo, mai sui server di un fornitore.',
    'index.howto.title': 'Come si inizia a usare Keeply e quanto ci vuole?',
    'index.howto.subtitle': 'Tre passaggi: scarica e installa (30 secondi), scegli una cartella, inizia a proteggere. Nessun account, nessun server, nessun comando da imparare. Funziona su Windows 10+ e macOS Apple Silicon. Vuoi annullare una modifica? Un solo clic.',
    'index.compare.title': 'In cosa Keeply è diverso da Dropbox, Google Drive o Git?',
    'index.compare.subtitle': 'Dropbox e Google Drive sincronizzano il file corrente e cancellano la cronologia delle versioni dopo 30 giorni; Git è pensato per gli ingegneri, con una curva di apprendimento ripida. Keeply riscrive il controllo versione per i file locali: ogni versione conservata per sempre, nessun lock-in cloud, nessuna barriera tecnica, installa e parti.',
    'index.pricing.title': 'Quanto costa Keeply e i team pagano per postazione?',
    'index.pricing.subtitle': 'Il piano individuale è gratuito per sempre, senza scadenza; il piano Team è una tariffa fissa di 25 $/mese (nessun limite di postazioni) con i file sul tuo NAS. Founding Member è una licenza perpetua una tantum a 599 $, limitata a 500 acquirenti. Nessun abbonamento, nessun costo per utente.',
    'index.download.title': 'Come si scarica Keeply ed è a pagamento?',
    'index.download.subtitle': 'Download gratuito, installazione in 30 secondi, subito utilizzabile. Supporta Windows 10/11 e macOS Apple Silicon. Nessuna carta di credito, nessuna scadenza di prova, nessun account da creare. Dopo l\'installazione, apri qualsiasi cartella e ogni salvataggio diventa una versione tracciata.'
  },
  'de': {
    'index.features.title': 'Warum ist Keeply mehr als ein Backup-Tool?',
    'index.features.subtitle': 'Backup-Tools merken sich nur die "aktuelle" Datei; Keeply merkt sich jede Version, jede Notiz, jede Entscheidung, die Sie getroffen haben. Sechs Monate später, wenn ein Kunde fragt: "Wer hat das entschieden?", öffnen Sie Keeply und finden die Antwort in Sekunden — das können Backup-Tools nicht.',
    'index.usecases.title': 'Wer nutzt Keeply und für welche Aufgaben ist es gedacht?',
    'index.usecases.answer': 'Projektmanager, Designer, Juristen, Wissenschaftler, Ingenieure und Remote-Teams — alle, deren Arbeit eine langfristige Versionshistorie, Entscheidungskontext oder die Flucht aus dem "final_v3"-Dateinamenchaos braucht. Dateien bleiben auf Ihrer Festplatte unter Ihrer Kontrolle, nie auf einem Anbieter-Server.',
    'index.howto.title': 'Wie fange ich mit Keeply an und wie lange dauert es?',
    'index.howto.subtitle': 'Drei Schritte: herunterladen und installieren (30 Sekunden), einen Ordner wählen, mit dem Schutz beginnen. Kein Konto, kein Server, keine Befehle zu lernen. Läuft unter Windows 10+ und macOS Apple Silicon. Eine Änderung zurücknehmen? Ein Klick.',
    'index.compare.title': 'Wie unterscheidet sich Keeply von Dropbox, Google Drive oder Git?',
    'index.compare.subtitle': 'Dropbox und Google Drive synchronisieren die aktuelle Datei und löschen die Versionshistorie nach 30 Tagen; Git ist für Ingenieure mit steiler Lernkurve. Keeply schreibt die Versionsverwaltung für lokale Dateien neu: jede Version für immer behalten, kein Cloud-Lock-in, keine Hürde für Nicht-Techniker, installieren und loslegen.',
    'index.pricing.title': 'Was kostet Keeply, und zahlen Teams pro Platz?',
    'index.pricing.subtitle': 'Die Einzelversion ist für immer kostenlos und läuft nicht ab; der Team-Plan kostet pauschal 25 $/Monat (ohne Platzbegrenzung), Dateien bleiben auf Ihrem eigenen NAS. Founding Member ist eine einmalige Lebenslizenz für 599 $, limitiert auf 500 Käufer. Kein Abo, keine Platzgebühr.',
    'index.download.title': 'Wie lade ich Keeply herunter, und kostet es etwas?',
    'index.download.subtitle': 'Kostenloser Download, 30-Sekunden-Installation, sofort einsatzbereit. Unterstützt Windows 10/11 und macOS Apple Silicon. Keine Kreditkarte, kein Testablauf, keine Kontoerstellung. Nach der Installation öffnen Sie einen Ordner — jede Speicherung wird automatisch als Version festgehalten.'
  },
  'fr': {
    'index.features.title': "Pourquoi Keeply n'est-il pas qu'un outil de sauvegarde ?",
    'index.features.subtitle': "Les outils de sauvegarde ne se souviennent que du fichier « actuel » ; Keeply se souvient de chaque version, chaque note, chaque décision que vous avez prise. Six mois plus tard, quand un client demande « qui a décidé cela ? », vous ouvrez Keeply et trouvez la réponse en quelques secondes — une capacité que les sauvegardes ne peuvent pas offrir.",
    'index.usecases.title': 'Qui utilise Keeply, et pour quels métiers est-il conçu ?',
    'index.usecases.answer': 'Chefs de projet, designers, juristes, universitaires, ingénieurs et équipes à distance — toute personne dont le travail exige un historique de versions longue durée, le contexte des décisions, ou de fuir le chaos des noms « final_v3 ». Les fichiers restent sur votre disque, sous votre contrôle, jamais sur un serveur tiers.',
    'index.howto.title': "Comment commencer avec Keeply, et combien de temps ça prend ?",
    'index.howto.subtitle': "Trois étapes : télécharger et installer (30 secondes), choisir un dossier, démarrer la protection. Pas de compte, pas de serveur, pas de commandes à apprendre. Fonctionne sur Windows 10+ et macOS Apple Silicon. Annuler une modification ? Un clic suffit.",
    'index.compare.title': "En quoi Keeply diffère-t-il de Dropbox, Google Drive ou Git ?",
    'index.compare.subtitle': "Dropbox et Google Drive synchronisent le fichier actuel et effacent l'historique des versions après 30 jours ; Git est conçu pour les ingénieurs, avec une courbe d'apprentissage abrupte. Keeply réécrit la gestion de versions pour les fichiers locaux : chaque version conservée à jamais, pas de verrouillage cloud, pas de barrière technique, installer et utiliser.",
    'index.pricing.title': "Combien coûte Keeply, et les équipes paient-elles par utilisateur ?",
    'index.pricing.subtitle': "La version individuelle est gratuite pour toujours, sans expiration ; le plan Équipe est à 25 $/mois forfaitaire (sans limite d'utilisateurs), avec les fichiers sur votre propre NAS. Founding Member est une licence perpétuelle à 599 $ en un seul paiement, limitée à 500 acheteurs. Pas d'abonnement, pas de frais par siège.",
    'index.download.title': "Comment télécharger Keeply, et est-ce payant ?",
    'index.download.subtitle': "Téléchargement gratuit, installation en 30 secondes, immédiatement utilisable. Prend en charge Windows 10/11 et macOS Apple Silicon. Pas de carte bancaire, pas de période d'essai, pas de création de compte. Après installation, ouvrez n'importe quel dossier — chaque enregistrement devient une version suivie automatiquement."
  },
  'es': {
    'index.features.title': '¿Por qué Keeply no es solo una herramienta de copia de seguridad?',
    'index.features.subtitle': 'Las herramientas de copia de seguridad solo recuerdan el archivo "actual"; Keeply recuerda cada versión, cada nota, cada decisión que tomaste. Seis meses después, cuando un cliente pregunta "¿quién decidió esto?", abres Keeply y encuentras la respuesta en segundos — algo que las copias de seguridad no pueden ofrecer.',
    'index.usecases.title': '¿Quién usa Keeply y para qué trabajos está pensado?',
    'index.usecases.answer': 'Gestores de proyecto, diseñadores, abogados, académicos, ingenieros y equipos remotos — cualquiera cuyo trabajo necesite un historial de versiones de larga duración, contexto de decisiones o escapar del caos de los nombres "final_v3". Los archivos permanecen en tu disco, bajo tu control, nunca en el servidor de un proveedor.',
    'index.howto.title': '¿Cómo empiezo a usar Keeply y cuánto tarda?',
    'index.howto.subtitle': 'Tres pasos: descargar e instalar (30 segundos), elegir una carpeta, empezar a proteger. Sin cuenta, sin servidor, sin comandos que aprender. Funciona en Windows 10+ y macOS Apple Silicon. ¿Quieres deshacer un cambio? Un solo clic.',
    'index.compare.title': '¿En qué se diferencia Keeply de Dropbox, Google Drive o Git?',
    'index.compare.subtitle': 'Dropbox y Google Drive sincronizan el archivo actual y borran el historial tras 30 días; Git está pensado para ingenieros con una curva de aprendizaje pronunciada. Keeply reescribe el control de versiones para archivos locales: cada versión se guarda para siempre, sin dependencia de la nube, sin barrera técnica, instalar y usar.',
    'index.pricing.title': '¿Cuánto cuesta Keeply y los equipos pagan por puesto?',
    'index.pricing.subtitle': 'El plan individual es gratis para siempre, sin caducidad; el plan Equipo es una tarifa plana de 25 $/mes (sin límite de puestos) con los archivos en tu propio NAS. Founding Member es una licencia perpetua de pago único por 599 $, limitada a 500 compradores. Sin suscripciones, sin tarifa por usuario.',
    'index.download.title': '¿Cómo descargo Keeply y es de pago?',
    'index.download.subtitle': 'Descarga gratuita, instalación en 30 segundos, listo para usar. Compatible con Windows 10/11 y macOS Apple Silicon. Sin tarjeta de crédito, sin caducidad de prueba, sin crear cuenta. Tras instalar, abre cualquier carpeta y cada guardado se versiona automáticamente.'
  },
  'pt': {
    'index.features.title': 'Por que o Keeply não é apenas uma ferramenta de backup?',
    'index.features.subtitle': 'Ferramentas de backup só lembram do arquivo "atual"; o Keeply lembra de cada versão, cada nota, cada decisão que você tomou. Seis meses depois, quando um cliente pergunta "quem decidiu isso?", você abre o Keeply e encontra a resposta em segundos — algo que o backup não consegue oferecer.',
    'index.usecases.title': 'Quem usa o Keeply e para quais trabalhos foi feito?',
    'index.usecases.answer': 'Gerentes de projeto, designers, advogados, acadêmicos, engenheiros e equipes remotas — qualquer um cujo trabalho precise de histórico de versões de longa duração, contexto de decisões ou fuga do caos dos nomes "final_v3". Os arquivos ficam no seu disco, sob seu controle, nunca no servidor de um fornecedor.',
    'index.howto.title': 'Como começo a usar o Keeply e quanto tempo leva?',
    'index.howto.subtitle': 'Três passos: baixar e instalar (30 segundos), escolher uma pasta, começar a proteger. Sem conta, sem servidor, sem comandos para aprender. Funciona no Windows 10+ e macOS Apple Silicon. Quer desfazer uma alteração? Um clique.',
    'index.compare.title': 'Como o Keeply é diferente de Dropbox, Google Drive ou Git?',
    'index.compare.subtitle': 'Dropbox e Google Drive sincronizam o arquivo atual e apagam o histórico após 30 dias; Git é para engenheiros com curva de aprendizado acentuada. O Keeply reescreve o controle de versão para arquivos locais: cada versão guardada para sempre, sem trava de nuvem, sem barreira técnica, instalar e usar.',
    'index.pricing.title': 'Quanto custa o Keeply e as equipes pagam por usuário?',
    'index.pricing.subtitle': 'O plano individual é grátis para sempre, sem expiração; o plano Equipe é uma taxa única de 25 $/mês (sem limite de usuários) com arquivos no seu próprio NAS. Founding Member é uma licença perpétua única por 599 $, limitada a 500 compradores. Sem assinaturas, sem taxa por assento.',
    'index.download.title': 'Como faço para baixar o Keeply e ele é pago?',
    'index.download.subtitle': 'Download grátis, instalação em 30 segundos, pronto para usar. Suporta Windows 10/11 e macOS Apple Silicon. Sem cartão de crédito, sem expiração de teste, sem criação de conta. Após instalar, abra qualquer pasta — cada salvamento vira uma versão rastreada automaticamente.'
  },
  'nl': {
    'index.features.title': 'Waarom is Keeply meer dan een back-uptool?',
    'index.features.subtitle': 'Back-uptools onthouden alleen het "huidige" bestand; Keeply onthoudt elke versie, elke notitie, elke beslissing die je hebt genomen. Zes maanden later, als een klant vraagt "wie heeft dit besloten?", open je Keeply en vind je het antwoord in seconden — iets wat back-uptools je niet kunnen geven.',
    'index.usecases.title': 'Wie gebruikt Keeply, en voor welke taken is het gemaakt?',
    'index.usecases.answer': 'Projectmanagers, ontwerpers, juristen, academici, ingenieurs en externe teams — iedereen wiens werk vraagt om langdurige versiegeschiedenis, beslissingscontext of ontsnapping aan "final_v3"-bestandsnaamchaos. Bestanden blijven op je schijf, onder jouw controle, nooit op een leverancier-server.',
    'index.howto.title': 'Hoe begin ik met Keeply, en hoe lang duurt het?',
    'index.howto.subtitle': 'Drie stappen: downloaden en installeren (30 seconden), kies een map, begin met beschermen. Geen account, geen server, geen commando\'s te leren. Werkt op Windows 10+ en macOS Apple Silicon. Een wijziging terugdraaien? Eén klik.',
    'index.compare.title': 'Hoe verschilt Keeply van Dropbox, Google Drive of Git?',
    'index.compare.subtitle': 'Dropbox en Google Drive synchroniseren het huidige bestand en wissen de versiegeschiedenis na 30 dagen; Git is gemaakt voor ingenieurs met een steile leercurve. Keeply herschrijft versiebeheer voor lokale bestanden: elke versie blijft voor altijd, geen cloudvergrendeling, geen technische drempel, installeren en gebruiken.',
    'index.pricing.title': 'Wat kost Keeply, en betalen teams per gebruiker?',
    'index.pricing.subtitle': 'De individuele versie is voor altijd gratis zonder vervaldatum; het Team-abonnement is een vast bedrag van 25 $/maand (geen gebruikerslimiet) met bestanden op je eigen NAS. Founding Member is een eenmalige levenslange licentie van 599 $, beperkt tot 500 kopers. Geen abonnementen, geen kosten per seat.',
    'index.download.title': 'Hoe download ik Keeply, en kost het geld?',
    'index.download.subtitle': 'Gratis download, installatie van 30 seconden, direct bruikbaar. Ondersteunt Windows 10/11 en macOS Apple Silicon. Geen creditcard, geen proefverloop, geen accountaanmaak. Na installatie open je een map — elke opslag wordt automatisch als versie bijgehouden.'
  },
  'pl': {
    'index.features.title': 'Dlaczego Keeply to coś więcej niż narzędzie do kopii zapasowych?',
    'index.features.subtitle': 'Narzędzia do kopii zapasowych pamiętają tylko „bieżący" plik; Keeply pamięta każdą wersję, każdą notatkę, każdą podjętą decyzję. Sześć miesięcy później, gdy klient pyta „kto to zdecydował?", otwierasz Keeply i znajdujesz odpowiedź w kilka sekund — to coś, czego kopie zapasowe nie potrafią dać.',
    'index.usecases.title': 'Kto używa Keeply i do jakich zadań jest stworzony?',
    'index.usecases.answer': 'Menedżerowie projektów, projektanci, prawnicy, akademicy, inżynierowie i zespoły zdalne — każdy, kto potrzebuje długiej historii wersji, kontekstu decyzji lub ucieczki od chaosu nazw „final_v3". Pliki pozostają na Twoim dysku, pod Twoją kontrolą, nigdy na serwerze dostawcy.',
    'index.howto.title': 'Jak zacząć korzystać z Keeply i ile to zajmuje?',
    'index.howto.subtitle': 'Trzy kroki: pobierz i zainstaluj (30 sekund), wybierz folder, zacznij chronić. Bez konta, bez serwera, bez poleceń do nauczenia. Działa na Windows 10+ i macOS Apple Silicon. Chcesz cofnąć zmianę? Jedno kliknięcie.',
    'index.compare.title': 'Czym Keeply różni się od Dropbox, Google Drive lub Git?',
    'index.compare.subtitle': 'Dropbox i Google Drive synchronizują bieżący plik i kasują historię wersji po 30 dniach; Git jest dla inżynierów ze stromą krzywą uczenia się. Keeply przepisuje kontrolę wersji dla plików lokalnych: każda wersja przechowywana na zawsze, brak uzależnienia od chmury, brak bariery technicznej, zainstaluj i działaj.',
    'index.pricing.title': 'Ile kosztuje Keeply i czy zespoły płacą za użytkownika?',
    'index.pricing.subtitle': 'Wersja indywidualna jest darmowa na zawsze, bez wygaśnięcia; plan Team to ryczałtowe 25 $/miesiąc (bez limitu użytkowników) z plikami na własnym NAS. Founding Member to jednorazowa wieczysta licencja za 599 $, ograniczona do 500 kupujących. Bez subskrypcji, bez opłat za stanowisko.',
    'index.download.title': 'Jak pobrać Keeply i czy jest płatny?',
    'index.download.subtitle': 'Darmowe pobieranie, instalacja w 30 sekund, gotowy do użycia. Obsługuje Windows 10/11 i macOS Apple Silicon. Bez karty kredytowej, bez wygaśnięcia okresu próbnego, bez zakładania konta. Po instalacji otwórz dowolny folder — każde zapisanie staje się automatycznie śledzoną wersją.'
  },
  'cs': {
    'index.features.title': 'Proč je Keeply víc než zálohovací nástroj?',
    'index.features.subtitle': 'Zálohovací nástroje si pamatují jen „aktuální" soubor; Keeply si pamatuje každou verzi, každou poznámku, každé rozhodnutí, které jste udělali. Po půl roce, když se klient zeptá „kdo to rozhodl?", otevřete Keeply a odpověď najdete během několika sekund — to zálohy nedokážou.',
    'index.usecases.title': 'Kdo používá Keeply a pro jakou práci je určen?',
    'index.usecases.answer': 'Projektoví manažeři, designéři, právníci, akademici, inženýři a vzdálené týmy — kdokoliv, jehož práce vyžaduje dlouhodobou historii verzí, kontext rozhodnutí nebo únik z chaosu názvů „final_v3". Soubory zůstávají na vašem disku, pod vaší kontrolou, nikdy na serveru poskytovatele.',
    'index.howto.title': 'Jak začít s Keeply a jak dlouho to trvá?',
    'index.howto.subtitle': 'Tři kroky: stáhnout a nainstalovat (30 sekund), vybrat složku, začít chránit. Žádný účet, žádný server, žádné příkazy k učení. Funguje na Windows 10+ a macOS Apple Silicon. Chcete vrátit změnu? Jediný klik.',
    'index.compare.title': 'V čem se Keeply liší od Dropbox, Google Drive nebo Git?',
    'index.compare.subtitle': 'Dropbox a Google Drive synchronizují aktuální soubor a mažou historii verzí po 30 dnech; Git je pro inženýry se strmou křivkou učení. Keeply přepisuje správu verzí pro lokální soubory: každá verze navždy uchována, žádné zaseknutí v cloudu, žádná technická bariéra, nainstalovat a používat.',
    'index.pricing.title': 'Kolik Keeply stojí a platí týmy za uživatele?',
    'index.pricing.subtitle': 'Individuální verze je zdarma navždy, bez expirace; plán Team je paušál 25 $/měsíc (bez limitu uživatelů) se soubory na vlastním NAS. Founding Member je jednorázová doživotní licence za 599 $, omezená na 500 kupců. Žádná předplatná, žádné poplatky za místo.',
    'index.download.title': 'Jak stáhnout Keeply a je placený?',
    'index.download.subtitle': 'Stažení zdarma, instalace za 30 sekund, okamžitě k použití. Podporuje Windows 10/11 a macOS Apple Silicon. Žádná platební karta, žádná expirace zkušebky, žádné zakládání účtu. Po instalaci otevřete libovolnou složku — každé uložení se automaticky stane sledovanou verzí.'
  },
  'hu': {
    'index.features.title': 'Miért több a Keeply, mint egy biztonsági mentő eszköz?',
    'index.features.subtitle': 'A biztonsági mentő eszközök csak a „jelenlegi" fájlt jegyzik meg; a Keeply minden verziót, minden jegyzetet, minden döntésedet megjegyzi. Fél év múlva, amikor egy ügyfél azt kérdezi, „ki döntött erről?", megnyitod a Keeply-t és másodpercek alatt megtalálod a választ — ezt a mentések nem tudják adni.',
    'index.usecases.title': 'Ki használja a Keeply-t, és milyen munkákra való?',
    'index.usecases.answer': 'Projektmenedzserek, tervezők, jogászok, akadémikusok, mérnökök és távoli csapatok — bárki, akinek hosszú távú verziótörténetre, döntési kontextusra vagy a „final_v3" fájlnévkáoszból való menekülésre van szüksége. A fájlok a saját lemezeden maradnak, a te irányításod alatt, soha nem egy szolgáltató szerverén.',
    'index.howto.title': 'Hogyan kezdjem el a Keeply használatát és mennyi időt vesz igénybe?',
    'index.howto.subtitle': 'Három lépés: letöltés és telepítés (30 másodperc), válassz egy mappát, kezdd el a védelmet. Nincs fiók, nincs szerver, nincsenek tanulandó parancsok. Windows 10+ és macOS Apple Silicon támogatása. Vissza akarsz vonni egy módosítást? Egy kattintás.',
    'index.compare.title': 'Miben különbözik a Keeply a Dropbox, Google Drive vagy Git megoldásoktól?',
    'index.compare.subtitle': 'A Dropbox és a Google Drive a jelenlegi fájlt szinkronizálja, és 30 nap után törli a verzió­előzményeket; a Git mérnököknek készült, meredek tanulási görbével. A Keeply újraírja a verziókezelést helyi fájlokhoz: minden verzió örökre megmarad, nincs felhőfüggőség, nincs technikai akadály, telepítsd és használd.',
    'index.pricing.title': 'Mennyibe kerül a Keeply, és a csapatok fejenként fizetnek?',
    'index.pricing.subtitle': 'Az egyéni verzió örökre ingyenes, lejárat nélkül; a Team csomag fix 25 $/hó (felhasználói korlát nélkül) a fájlokkal a saját NAS-odon. A Founding Member egyszeri élethosszig tartó licenc 599 $-ért, 500 vásárlóra korlátozva. Nincs előfizetés, nincs ülésdíj.',
    'index.download.title': 'Hogyan tölthetem le a Keeply-t, és fizetős?',
    'index.download.subtitle': 'Ingyenes letöltés, 30 másodperces telepítés, azonnal használható. Támogatja a Windows 10/11 és macOS Apple Silicon rendszereket. Nincs hitelkártya, nincs próbaverzió lejárat, nincs fióklétrehozás. Telepítés után nyiss meg bármelyik mappát — minden mentés automatikusan verziókövetett lesz.'
  },
  'tr': {
    'index.features.title': 'Keeply neden sadece bir yedekleme aracından fazlasıdır?',
    'index.features.subtitle': 'Yedekleme araçları yalnızca "mevcut" dosyayı hatırlar; Keeply her sürümü, her notu, verdiğin her kararı hatırlar. Altı ay sonra bir müşteri "buna kim karar verdi?" diye sorduğunda Keeply\'i açar ve cevabı saniyeler içinde bulursun — yedeklemelerin sağlayamadığı bir yetenek.',
    'index.usecases.title': 'Keeply\'i kimler kullanır ve hangi işler için tasarlandı?',
    'index.usecases.answer': 'Proje yöneticileri, tasarımcılar, hukukçular, akademisyenler, mühendisler ve uzaktan ekipler — uzun ömürlü sürüm geçmişine, karar bağlamına ya da "final_v3" dosya adı kaosundan kurtulmaya ihtiyaç duyan herkes. Dosyalar diskinde, senin kontrolünde kalır; asla bir sağlayıcı sunucusunda olmaz.',
    'index.howto.title': 'Keeply\'i nasıl kullanmaya başlarım ve ne kadar sürer?',
    'index.howto.subtitle': 'Üç adım: indir ve kur (30 saniye), bir klasör seç, korumayı başlat. Hesap yok, sunucu yok, öğrenilecek komut yok. Windows 10+ ve macOS Apple Silicon\'da çalışır. Bir değişikliği geri almak ister misin? Tek tıkla.',
    'index.compare.title': 'Keeply, Dropbox, Google Drive veya Git\'ten nasıl farklıdır?',
    'index.compare.subtitle': 'Dropbox ve Google Drive mevcut dosyayı senkronize eder ve 30 gün sonra sürüm geçmişini siler; Git mühendisler için, dik bir öğrenme eğrisi var. Keeply yerel dosyalar için sürüm kontrolünü yeniden yazar: her sürüm sonsuza dek saklanır, bulut bağımlılığı yok, teknik engel yok, kur ve kullan.',
    'index.pricing.title': 'Keeply ne kadar tutar ve ekipler kişi başı mı öder?',
    'index.pricing.subtitle': 'Bireysel sürüm sonsuza dek ücretsizdir ve süresi dolmaz; Takım planı aylık 25 $ sabit ücretlidir (kullanıcı sınırı yok) ve dosyalar kendi NAS\'ında kalır. Founding Member tek seferlik 599 $ ödemeyle ömür boyu lisanstır ve 500 alıcıyla sınırlıdır. Abonelik yok, kişi başı ücret yok.',
    'index.download.title': 'Keeply\'i nasıl indirebilirim ve ücretli mi?',
    'index.download.subtitle': 'Ücretsiz indirme, 30 saniyelik kurulum, anında kullanıma hazır. Windows 10/11 ve macOS Apple Silicon destekler. Kredi kartı, deneme süresi sonu veya hesap oluşturma gerekmez. Kurduktan sonra herhangi bir klasörü aç — her kaydetme otomatik olarak izlenen bir sürüm olur.'
  },
  'fi': {
    'index.features.title': 'Miksi Keeply on enemmän kuin varmuuskopiointityökalu?',
    'index.features.subtitle': 'Varmuuskopiointityökalut muistavat vain "nykyisen" tiedoston; Keeply muistaa jokaisen version, jokaisen muistiinpanon, jokaisen tekemäsi päätöksen. Puoli vuotta myöhemmin, kun asiakas kysyy "kuka tämän päätti?", avaat Keeplyn ja löydät vastauksen sekunneissa — sitä varmuuskopiot eivät pysty tarjoamaan.',
    'index.usecases.title': 'Kuka käyttää Keeplyä, ja mihin töihin se on tarkoitettu?',
    'index.usecases.answer': 'Projektipäälliköt, suunnittelijat, juristit, tutkijat, insinöörit ja etätiimit — kuka tahansa, jonka työ vaatii pitkäaikaista versiohistoriaa, päätösten kontekstia tai pakoa "final_v3"-tiedostonimien kaaoksesta. Tiedostot pysyvät levylläsi, sinun hallinnassasi, eivät koskaan toimittajan palvelimella.',
    'index.howto.title': 'Miten aloitan Keeplyn käytön, ja kuinka kauan se kestää?',
    'index.howto.subtitle': 'Kolme askelta: lataa ja asenna (30 sekuntia), valitse kansio, aloita suojaaminen. Ei tiliä, ei palvelinta, ei opeteltavia komentoja. Toimii Windows 10+:ssa ja macOS Apple Siliconilla. Haluatko peruuttaa muutoksen? Yksi klikkaus.',
    'index.compare.title': 'Miten Keeply eroaa Dropboxista, Google Drivesta tai Gitistä?',
    'index.compare.subtitle': 'Dropbox ja Google Drive synkronoivat nykyisen tiedoston ja poistavat versiohistorian 30 päivän jälkeen; Git on insinööreille, ja sen oppimiskäyrä on jyrkkä. Keeply kirjoittaa versionhallinnan paikallisille tiedostoille uudelleen: jokainen versio säilyy ikuisesti, ei pilvi­lukitusta, ei teknistä estettä, asenna ja käytä.',
    'index.pricing.title': 'Paljonko Keeply maksaa, ja maksavatko tiimit per käyttäjä?',
    'index.pricing.subtitle': 'Yksilöversio on ikuisesti ilmainen ilman vanhenemista; Team-paketti on kiinteä 25 $/kk (ei käyttäjärajaa) tiedostojen kanssa omalla NAS-laitteellasi. Founding Member on kertaluonteinen ikuislisenssi 599 $, rajoitettu 500 ostajaan. Ei tilauksia, ei käyttäjäkohtaisia maksuja.',
    'index.download.title': 'Miten lataan Keeplyn, ja onko se maksullinen?',
    'index.download.subtitle': 'Ilmainen lataus, 30 sekunnin asennus, heti käyttövalmis. Tukee Windows 10/11 ja macOS Apple Silicon. Ei luottokorttia, ei kokeilun päättymistä, ei tilin luomista. Asennuksen jälkeen avaa mikä tahansa kansio — jokainen tallennus tulee automaattisesti seuratuksi versioksi.'
  },
  'sv': {
    'index.features.title': 'Varför är Keeply mer än ett säkerhetskopieringsverktyg?',
    'index.features.subtitle': 'Säkerhetskopieringsverktyg minns bara den "aktuella" filen; Keeply minns varje version, varje anteckning, varje beslut du har fattat. Sex månader senare, när en kund frågar "vem bestämde det här?", öppnar du Keeply och hittar svaret på några sekunder — det är något som säkerhetskopior inte kan ge dig.',
    'index.usecases.title': 'Vem använder Keeply och vilka jobb är det byggt för?',
    'index.usecases.answer': 'Projektledare, designer, jurister, akademiker, ingenjörer och distansteam — alla vars arbete kräver långlivad versionshistorik, beslutskontext eller flykt från "final_v3"-filnamnskaos. Filerna stannar på din disk under din kontroll, aldrig på en leverantörsserver.',
    'index.howto.title': 'Hur börjar jag använda Keeply och hur lång tid tar det?',
    'index.howto.subtitle': 'Tre steg: ladda ner och installera (30 sekunder), välj en mapp, börja skydda. Inget konto, ingen server, inga kommandon att lära sig. Fungerar på Windows 10+ och macOS Apple Silicon. Vill du ångra en ändring? Ett klick.',
    'index.compare.title': 'Hur skiljer sig Keeply från Dropbox, Google Drive eller Git?',
    'index.compare.subtitle': 'Dropbox och Google Drive synkar den aktuella filen och rensar versionshistoriken efter 30 dagar; Git är byggt för ingenjörer med brant inlärningskurva. Keeply skriver om versionshantering för lokala filer: varje version sparas för alltid, ingen molnlåsning, ingen teknisk barriär, installera och kör.',
    'index.pricing.title': 'Vad kostar Keeply, och betalar team per användare?',
    'index.pricing.subtitle': 'Den individuella versionen är gratis för alltid utan utgångsdatum; Team-planen är ett fast pris på 25 $/månad (ingen platsgräns) med filerna på din egen NAS. Founding Member är en engångs livstidslicens för 599 $, begränsad till 500 köpare. Inga prenumerationer, inga platsavgifter.',
    'index.download.title': 'Hur laddar jag ner Keeply, och är det betalt?',
    'index.download.subtitle': 'Gratis nedladdning, 30 sekunders installation, omedelbart användbart. Stöder Windows 10/11 och macOS Apple Silicon. Inget kreditkort, ingen testperiod som löper ut, inget konto att skapa. Efter installation öppnar du en valfri mapp — varje sparning blir automatiskt en spårad version.'
  },
  'no': {
    'index.features.title': 'Hvorfor er Keeply mer enn et sikkerhetskopieringsverktøy?',
    'index.features.subtitle': 'Sikkerhetskopieringsverktøy husker bare den "nåværende" filen; Keeply husker hver versjon, hvert notat, hver beslutning du har tatt. Seks måneder senere, når en kunde spør "hvem bestemte dette?", åpner du Keeply og finner svaret på sekunder — det er noe sikkerhetskopier ikke kan gi deg.',
    'index.usecases.title': 'Hvem bruker Keeply, og hvilke jobber er det laget for?',
    'index.usecases.answer': 'Prosjektledere, designere, advokater, akademikere, ingeniører og fjernteam — alle hvis arbeid trenger langvarig versjonshistorikk, beslutningskontekst eller flukt fra "final_v3"-filnavnkaos. Filene blir på disken din under din kontroll, aldri på en leverandørserver.',
    'index.howto.title': 'Hvordan begynner jeg med Keeply, og hvor lang tid tar det?',
    'index.howto.subtitle': 'Tre trinn: last ned og installer (30 sekunder), velg en mappe, start beskyttelse. Ingen konto, ingen server, ingen kommandoer å lære. Fungerer på Windows 10+ og macOS Apple Silicon. Vil du angre en endring? Ett klikk.',
    'index.compare.title': 'Hvordan skiller Keeply seg fra Dropbox, Google Drive eller Git?',
    'index.compare.subtitle': 'Dropbox og Google Drive synkroniserer den nåværende filen og sletter versjonshistorikken etter 30 dager; Git er bygget for ingeniører med bratt læringskurve. Keeply skriver om versjonskontroll for lokale filer: hver versjon beholdes for alltid, ingen skylåsing, ingen teknisk barriere, installer og kjør.',
    'index.pricing.title': 'Hva koster Keeply, og betaler team per bruker?',
    'index.pricing.subtitle': 'Individuell versjon er gratis for alltid uten utløp; Team-planen er en fast pris på 25 $/måned (uten brukergrense) med filer på din egen NAS. Founding Member er en engangs livstidslisens for 599 $, begrenset til 500 kjøpere. Ingen abonnementer, ingen seteavgifter.',
    'index.download.title': 'Hvordan laster jeg ned Keeply, og er det betalt?',
    'index.download.subtitle': 'Gratis nedlasting, 30-sekunders installasjon, klar til bruk umiddelbart. Støtter Windows 10/11 og macOS Apple Silicon. Ingen kredittkort, ingen prøveutløp, ingen kontooppretting. Etter installasjon åpner du en hvilken som helst mappe — hver lagring blir automatisk en sporet versjon.'
  },
  'da': {
    'index.features.title': 'Hvorfor er Keeply mere end et backup-værktøj?',
    'index.features.subtitle': 'Backup-værktøjer husker kun den "aktuelle" fil; Keeply husker hver version, hver note, hver beslutning du har truffet. Et halvt år senere, når en kunde spørger "hvem besluttede det?", åbner du Keeply og finder svaret på få sekunder — det er noget, backups ikke kan give dig.',
    'index.usecases.title': 'Hvem bruger Keeply, og hvilke job er det bygget til?',
    'index.usecases.answer': 'Projektledere, designere, jurister, akademikere, ingeniører og fjernhold — alle, hvis arbejde kræver langvarig versionshistorik, beslutningskontekst eller flugt fra "final_v3"-filnavnkaos. Filerne bliver på din disk under din kontrol, aldrig på en leverandørserver.',
    'index.howto.title': 'Hvordan starter jeg med Keeply, og hvor lang tid tager det?',
    'index.howto.subtitle': 'Tre trin: download og installer (30 sekunder), vælg en mappe, start beskyttelse. Ingen konto, ingen server, ingen kommandoer at lære. Virker på Windows 10+ og macOS Apple Silicon. Vil du fortryde en ændring? Ét klik.',
    'index.compare.title': 'Hvordan adskiller Keeply sig fra Dropbox, Google Drive eller Git?',
    'index.compare.subtitle': 'Dropbox og Google Drive synkroniserer den aktuelle fil og rydder versionshistorikken efter 30 dage; Git er bygget til ingeniører med stejl indlæringskurve. Keeply omskriver versionsstyring til lokale filer: hver version bevares for evigt, ingen cloud-låsning, ingen teknisk barriere, installer og kør.',
    'index.pricing.title': 'Hvad koster Keeply, og betaler hold per bruger?',
    'index.pricing.subtitle': 'Den individuelle version er gratis for evigt uden udløb; Team-planen er en fast pris på 25 $/måned (uden brugergrænse) med filer på din egen NAS. Founding Member er en engangs livstidslicens til 599 $, begrænset til 500 købere. Ingen abonnementer, ingen brugergebyrer.',
    'index.download.title': 'Hvordan downloader jeg Keeply, og er det betalt?',
    'index.download.subtitle': 'Gratis download, 30-sekunders installation, klar til brug straks. Understøtter Windows 10/11 og macOS Apple Silicon. Intet kreditkort, ingen prøveudløb, ingen kontooprettelse. Efter installation åbner du en hvilken som helst mappe — hver gemning bliver automatisk til en sporet version.'
  }
};

function main() {
  const locales = Object.keys(TRANSLATIONS);
  let updated = 0;
  for (const locale of locales) {
    const fp = path.join(I18N_DIR, `${locale}.json`);
    if (!fs.existsSync(fp)) {
      console.warn(`SKIP: ${fp} missing`);
      continue;
    }
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const patch = TRANSLATIONS[locale];
    for (const key of Object.keys(patch)) {
      j[key] = patch[key];
    }
    fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n', 'utf8');
    updated++;
    console.log(`updated ${locale} (${Object.keys(patch).length} keys)`);
  }
  console.log(`\nPatched ${updated}/${locales.length} locales.`);
}

main();
