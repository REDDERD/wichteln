# Familien-Wichteln

Kleine Website zum Wichteln in der Familie. Sie läuft als statische Seite auf GitHub Pages und speichert ihre Daten in Firebase Firestore.

- Jeder meldet sich mit einem persönlichen Kennwort an, oder einfach über einen persönlichen Link.
- Beim ersten Besuch nach der Auslosung lost jeder selbst über eine Lostrommel. Das Ergebnis steht dabei schon vorher fest.
- Jeder pflegt seine eigene Wunschliste. Lesen kann sie nur die Person, die einen gezogen hat.
- Der Admin legt Teilnehmer, Kennwörter, Ausschlüsse und das Budget fest und bereitet die Auslosung vor.

## Aufbau

| Datei | Zweck |
|---|---|
| `index.html`, `js/app.js` | Seite für Teilnehmer: Anmelden, Losen, Wunschliste |
| `admin.html`, `js/admin.js` | Verwaltung |
| `js/slot.js`, `js/confetti.js` | Lostrommel und Konfetti |
| `js/graph.js` | Grafik der Paarungen für den Admin |
| `js/draw.js` | Auslosung mit Ausschlüssen |
| `js/kennwort.js` | Kennwort-Normalisierung, Vorschläge, persönliche Links |
| `js/firebase.js`, `js/firebase-config.js` | Firebase SDK und Projektkonfiguration |
| `firestore.rules` | Zugriffsregeln, sie schützen die Paarungen |

Es gibt keinen Build-Schritt. Das Firebase SDK wird direkt von gstatic.com geladen.

### Daten in Firestore

| Pfad | Inhalt | Wer liest |
|---|---|---|
| `settings/main` | `budget`, `drawnAt` | alle Teilnehmer |
| `participants/{pid}` | `name`, `exclusions` | alle Teilnehmer (für die Lostrommel) |
| `secrets/{pid}` | `kennwort`, `uid` | nur Admin |
| `accounts/{uid}` | `participantId` | der Nutzer selbst, Admin |
| `assignments/{schenkerPid}` | `receiverId`, `revealed` | der Schenker selbst, Admin |
| `wishlists/{pid}` | `items` | der Besitzer und die Person, die ihn gezogen hat |

### Anmeldung nur mit Kennwort

Firebase Auth braucht eigentlich E-Mail und Passwort. Beides wird aus dem Kennwort abgeleitet: Die E-Mail ist ein SHA-256-Hash des Kennworts mit `@wichteln.example.com`, das Passwort ist das Kennwort selbst mit einem festen Präfix. Vorher wird das Kennwort normalisiert. Groß- und Kleinschreibung, Umlaute (ä = ae), Bindestriche und doppelte Leerzeichen spielen also keine Rolle.

Der persönliche Link hat die Form `https://<name>.github.io/<repo>/#k=tanne-stern`. Der Teil nach `#` wird nie an einen Server geschickt.

Neue Teilnehmer-Konten legt der Admin über eine zweite Firebase-Instanz direkt im Browser an. Ändert der Admin ein Kennwort, wird ein neues Konto angelegt und das alte gelöscht.

## Einrichtung

1. **Firebase-Projekt**: In der [Firebase-Konsole](https://console.firebase.google.com) ein Projekt anlegen oder ein vorhandenes nutzen. Darin eine **Web-App** registrieren.
2. **Authentication**: Den Anbieter **E-Mail/Passwort** aktivieren. Die Option zum Anlegen neuer Konten muss eingeschaltet bleiben, sonst kann der Admin keine Teilnehmer anlegen. Fremde Konten bekommen durch die Rules trotzdem keinen Zugriff.
3. **Firestore**: Eine Datenbank im Produktionsmodus anlegen.
4. **Admin-Konto**: Unter Authentication > Nutzer > „Nutzer hinzufügen“ ein Konto mit deiner E-Mail und einem starken Passwort anlegen. Dann dessen **UID** kopieren.
5. **Konfiguration**:
   - `js/firebase-config.js`: die Werte der Web-App und die Admin-UID eintragen.
   - `firestore.rules`: in `isAdmin()` dieselbe UID statt `HIER_EINTRAGEN` eintragen.
6. **Rules veröffentlichen**:
   ```
   npm install -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules
   ```
7. **GitHub Pages**: Im Repository unter Settings > Pages die Quelle „Deploy from a branch“, Branch `main`, Ordner `/ (root)` wählen.
8. **Autorisierte Domain**: In Firebase unter Authentication > Einstellungen > Autorisierte Domains `<name>.github.io` hinzufügen.

Zum lokalen Testen reicht ein einfacher Webserver, z. B. `npx serve .` oder `python -m http.server`. `localhost` ist in Firebase schon autorisiert.

## Ablauf

1. `admin.html` öffnen und mit dem Admin-Konto anmelden.
2. Budget eintragen.
3. Alle Teilnehmer anlegen, auch dich selbst mit einem normalen Kennwort. Die Seite schlägt dafür Kennwörter aus zwei Wörtern vor, z. B. „tanne stern“. Die sind leicht zu merken und schwer zu erraten. Vornamen sind als Kennwort ungeeignet, weil jeder sie erraten kann.
4. Ausschlüsse für Paare eintragen.
5. **Auslosung vorbereiten**. Ab jetzt lassen sich Teilnehmer und Ausschlüsse nur noch ändern, wenn die Auslosung zurückgesetzt wird.
6. Bei jedem Teilnehmer auf **Einladung kopieren** klicken und den Text z. B. per WhatsApp verschicken.
7. In der Übersicht siehst du, wer schon gelost hat. Die Namen der Paarungen bleiben verborgen, bis du sie ausdrücklich einblendest.

Wünsche kann jeder auch schon vor der Auslosung eintragen.
