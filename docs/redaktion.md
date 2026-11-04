# Redaktionsleitfaden (Directus Studio)

Für Verbandsbenutzer, die News, Seiten und die Navigation pflegen. Anmeldung im Studio unter
der Directus-Adresse (lokal http://localhost:8055) mit dem eigenen Konto.

## News

**Inhalte → News → „+“**

| Feld                           | Hinweis                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| Status                         | _Entwurf_ = nicht sichtbar, _Veröffentlicht_ = sichtbar, _Archiviert_ = ausgeblendet         |
| Veröffentlichungsdatum         | Liegt es in der Zukunft, erscheint der Artikel automatisch erst dann                         |
| Titel, URL-Kürzel              | Das Kürzel bildet die Adresse `/news/<kürzel>` – nach der Veröffentlichung nicht mehr ändern |
| Kategorie                      | Genau eine Kategorie (Kategorien unter _News-Kategorien_, deaktivieren statt löschen)        |
| Anreißer                       | Kurzer Text für Übersichten und die Startseite                                               |
| Inhalt                         | Editor mit Überschriften, Listen, Links, Bildern, Tabellen                                   |
| Titelbild                      | Erscheint in Übersichten und über dem Artikel                                                |
| Autor / abweichender Autorname | Leer = Ersteller; Autorname z. B. für Gastbeiträge                                           |

## Seiten

**Inhalte → Seiten.** Die Adresse ergibt sich aus den Kürzeln: Seite _vorstand_ unter Seite
_verband_ → `/verband/vorstand`.

- **Übergeordnete Seite** festlegen, um Seiten zu verschachteln. Unterseiten werden auf der
  übergeordneten Seite automatisch verlinkt.
- **Sichtbarkeit**: _Öffentlich_, _Verein_ (alle Vereinsmitglieder), _Vereinsvertreter_,
  _Verband_. Geschützte Seiten erscheinen im internen Bereich unter `/intern/seiten/<pfad>`; wer
  die alte öffentliche Adresse aufruft, wird zur Anmeldung geleitet. Wer angemeldet ist, aber
  nicht die nötige Stufe hat, sieht „Dafür fehlt dir die Berechtigung.“
- Unterseiten sind nie sichtbarer als ihre übergeordnete Seite: Eine öffentliche Unterseite einer
  Verbandsseite ist ebenfalls nur für den Verband sichtbar.
- Eine Seite im Status _Entwurf_ blendet auch alle ihre Unterseiten aus.
- Die Seite **startseite** liefert den Einleitungstext der Startseite.
- Kürzel `news`, `veranstaltungen`, `vereine`, `intern`, `login`, `einladung`, `kalender`, `medien`, `api`
  auf oberster Ebene nicht verwenden – diese Adressen sind fest vergeben.

## Bilder und Dateien

| Ordner                 | Wohin hochgeladen wird      | Wer die Datei abrufen kann                                                                      |
| ---------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| **Öffentliche Medien** | News (Editor und Titelbild) | **alle** – vertrauliche Dokumente niemals hier ablegen                                          |
| **Seitendokumente**    | Editor von _Seiten_         | wer mindestens eine **veröffentlichte** Seite sehen darf, die die Datei verlinkt oder einbindet |

Dokumente für Vereine also einfach im Editor der geschützten Seite hochladen und verlinken. Eine
Datei, die von keiner veröffentlichten Seite mehr verwendet wird, ist für niemanden abrufbar –
auch nicht über eine kopierte Adresse. Dateien aus anderen Ordnern werden nie ausgeliefert.

## Navigation

**Inhalte → Navigation.** Reihenfolge per Drag & Drop, Verschachtelung über _Übergeordneter
Eintrag_.

| Linktyp       | Ziel                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| Seite         | eine Seite aus _Seiten_                                                       |
| News-Artikel  | ein Artikel                                                                   |
| Interner Pfad | z. B. `/veranstaltungen`, `/news`, `/vereine`                                 |
| Externe URL   | `https://…`, optional in neuem Tab                                            |
| Kein Link     | nur Gruppenüberschrift (wird ausgeblendet, wenn keine sichtbaren Unterpunkte) |

Menü _Hauptnavigation_ = Kopfzeile, _Fußzeile_ = Links unten, _Interner Bereich_ = Menü im
internen Bereich (unter den festen Einträgen wie Veranstaltungen). Über _Sichtbarkeit_ am Eintrag
und an der Zielseite lässt sich steuern, wer den Eintrag sieht. Einträge mit nicht veröffentlichtem
Ziel werden automatisch ausgeblendet. Änderungen sind sofort sichtbar.

## Weiterleitungen

**Inhalte → Weiterleitungen** für alte Adressen (z. B. aus Joomla):
_Alter Pfad_ `/index.php?option=com_content&id=12` → _Ziel_ `/verband/satzung`. Greift nur, wenn
unter dem alten Pfad keine Seite existiert. _Dauerhaft_ (301/308) ist der Normalfall.

## Benachrichtigungen

**Benachrichtigungen**: E-Mail-Empfänger für neue Vereinsvertreter und für eingereichte
Veranstaltungen. Die Empfänger erhalten dadurch keine zusätzlichen Rechte.
