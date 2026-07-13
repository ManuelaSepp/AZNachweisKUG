const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbykN76RiOVXfU28zYFmlh-t94mYXB7t6cD9bwKkVv91ZZ70j37TafrPTbcZKSKflserpg/exec";

const state = {
  eintraege: [],
  taetigkeiten: [],
  kalenderDatum: new Date(),
  originalDatum: null,
  ausgewaehltesDatum: null
};

const form = document.getElementById("entryForm");
const datum = document.getElementById("datum");
const arbeitsort = document.getElementById("arbeitsort");
const taetigkeit = document.getElementById("taetigkeit");
const stunden = document.getElementById("stunden");
const urlaub = document.getElementById("urlaub");
const krank = document.getElementById("krank");
const saveButton = document.getElementById("saveButton");
const updateButton = document.getElementById("updateButton");
const deleteButton = document.getElementById("deleteButton");
const cancelButton = document.getElementById("cancelButton");
const buttonRow = document.getElementById("buttonRow");
const meldung = document.getElementById("meldung");
const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");
const dayTooltip = document.getElementById("dayTooltip");

window.addEventListener("load", init);
form.addEventListener("submit", speichern);
updateButton.addEventListener("click", aktualisieren);
deleteButton.addEventListener("click", loeschen);
cancelButton.addEventListener("click", bearbeitungBeenden);
datum.addEventListener("change", datumGeaendert);
prevMonth.addEventListener("click", () => monatWechseln(-1));
nextMonth.addEventListener("click", () => monatWechseln(1));

urlaub.addEventListener("change", () => {
  if (urlaub.value === "Ja") krank.value = "Nein";
  handleAbwesenheit();
});

krank.addEventListener("change", () => {
  if (krank.value === "Ja") urlaub.value = "Nein";
  handleAbwesenheit();
});

async function init() {
  setzeHeute();
  state.ausgewaehltesDatum = datum.value;
  state.kalenderDatum = datumAusIso(datum.value);
  handleAbwesenheit();
  await ladeMonat();
}

async function ladeMonat() {
  try {
    zeigeMeldung("Lade Daten ...", "");

    const jahr = state.kalenderDatum.getFullYear();
    const monat = state.kalenderDatum.getMonth() + 1;

    const data = await jsonpRequest({
      action: "init",
      jahr,
      monat
    });

    if (!data.ok) {
      throw new Error(data.message || "Daten konnten nicht geladen werden.");
    }

    state.eintraege = data.eintraege || [];
    state.taetigkeiten = data.taetigkeiten || [];

    renderTaetigkeiten(state.taetigkeiten);
    renderKalender();
    zeigeMeldung("", "");
  } catch (err) {
    zeigeMeldung("Fehler: " + err.message, "error");
  }
}

async function speichern(event) {
  event.preventDefault();

  const daten = formularDaten();
  const fehler = validiere(daten);

  if (fehler) {
    zeigeMeldung(fehler, "error");
    return;
  }

  if (state.eintraege.some(e => e.datum === daten.datum)) {
    zeigeMeldung("Für dieses Datum wurde bereits ein Eintrag erfasst.", "error");
    return;
  }

  await aktionAusfuehren("save", daten);
}

async function aktualisieren() {
  if (!state.originalDatum) return;

  const daten = {
    ...formularDaten(),
    originalDatum: state.originalDatum
  };

  const fehler = validiere(daten);

  if (fehler) {
    zeigeMeldung(fehler, "error");
    return;
  }

  await aktionAusfuehren("update", daten);
}

async function loeschen() {
  if (!state.originalDatum) return;

  const wirklich = window.confirm(
    "Soll der Eintrag vom " + datum.value + " wirklich gelöscht werden?"
  );

  if (!wirklich) return;

  await aktionAusfuehren("delete", {
    datum: state.originalDatum
  });
}

async function aktionAusfuehren(action, daten) {
  alleButtonsDeaktivieren(true);
  zeigeMeldung("Bitte warten ...", "");

  try {
    const data = await jsonpRequest({
      action,
      payload: JSON.stringify(daten)
    });

    if (!data.ok) {
      throw new Error(data.message || "Aktion fehlgeschlagen.");
    }

    zeigeMeldung(data.message || "Erledigt ✅", "success");

    const zielDatum = datumAusIso(
      action === "delete"
        ? state.originalDatum
        : daten.datum
    );

    state.kalenderDatum = new Date(
      zielDatum.getFullYear(),
      zielDatum.getMonth(),
      1
    );
    state.ausgewaehltesDatum = toIsoDate(zielDatum);

    bearbeitungBeenden(false);
    datum.value = state.ausgewaehltesDatum;
    await ladeMonat();
  } catch (err) {
    zeigeMeldung("Fehler: " + err.message, "error");
  } finally {
    alleButtonsDeaktivieren(false);
  }
}

function formularDaten() {
  return {
    datum: datum.value,
    arbeitsort: arbeitsort.value,
    taetigkeit: taetigkeit.value,
    stunden: stunden.value,
    urlaub: urlaub.value,
    krank: krank.value
  };
}

function eintragLaden(eintrag) {
  state.originalDatum = eintrag.datum;
  state.ausgewaehltesDatum = eintrag.datum;

  datum.value = eintrag.datum;
  arbeitsort.value = eintrag.arbeitsort || "";
  taetigkeit.value = eintrag.taetigkeit || "";
  stunden.value = eintrag.stunden || "";

  urlaub.value = Number(eintrag.urlaub) > 0 ? "Ja" : "Nein";
  krank.value = Number(eintrag.krank) > 0 ? "Ja" : "Nein";

  handleAbwesenheit();
  bearbeitungsmodusSetzen(true);
  zeigeMeldung("Eintrag geladen – ändern oder löschen.", "");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bearbeitungsmodusSetzen(aktiv) {
  saveButton.hidden = aktiv;
  updateButton.hidden = !aktiv;
  deleteButton.hidden = !aktiv;
  buttonRow.classList.toggle("edit-mode", aktiv);
}

function bearbeitungBeenden(setzeAufHeute = true) {
  state.originalDatum = null;
  bearbeitungsmodusSetzen(false);

  arbeitsort.value = "";
  taetigkeit.value = "";
  stunden.value = "";
  urlaub.value = "Nein";
  krank.value = "Nein";

  if (setzeAufHeute) {
    setzeHeute();
    state.ausgewaehltesDatum = datum.value;
  }

  handleAbwesenheit();
  zeigeMeldung("", "");
}

function alleButtonsDeaktivieren(deaktiviert) {
  saveButton.disabled = deaktiviert;
  updateButton.disabled = deaktiviert;
  deleteButton.disabled = deaktiviert;
  cancelButton.disabled = deaktiviert;
}

function renderKalender() {
  const jahr = state.kalenderDatum.getFullYear();
  const monatIndex = state.kalenderDatum.getMonth();
  const ersterTag = new Date(jahr, monatIndex, 1);
  const letzterTag = new Date(jahr, monatIndex + 1, 0);
  const startOffset = (ersterTag.getDay() + 6) % 7;
  const heuteIso = toIsoDate(new Date());

  monthLabel.textContent = state.kalenderDatum.toLocaleString("de-DE", {
    month: "long",
    year: "numeric"
  });

  const eintragsMap = new Map(
    state.eintraege.map(e => [e.datum, e])
  );

  calendarGrid.innerHTML = "";

  ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].forEach((name) => {
    const zelle = document.createElement("div");
    zelle.className = "day-name";
    zelle.textContent = name;
    calendarGrid.appendChild(zelle);
  });

  for (let i = 0; i < startOffset; i++) {
    const leer = document.createElement("div");
    leer.className = "day-cell empty";
    calendarGrid.appendChild(leer);
  }

  for (let tag = 1; tag <= letzterTag.getDate(); tag++) {
    const aktuellesDatum = new Date(jahr, monatIndex, tag);
    const iso = toIsoDate(aktuellesDatum);
    const eintrag = eintragsMap.get(iso);

    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "day-cell " +
      statusKlasse(eintrag) +
      (iso === heuteIso ? " today" : "") +
      (iso === state.ausgewaehltesDatum ? " selected" : "");

    button.innerHTML =
      `<span class="day-number">${tag}</span>` +
      `<span class="status-label">${statusText(eintrag)}</span>`;

    button.addEventListener("click", () => {
      tooltipAusblenden();
      state.ausgewaehltesDatum = iso;
      datum.value = iso;
      renderKalender();

      if (eintrag) {
        eintragLaden(eintrag);
      } else {
        bearbeitungBeenden(false);
        datum.value = iso;
        state.ausgewaehltesDatum = iso;
        renderKalender();
        zeigeMeldung("", "");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    if (eintrag) {
      button.addEventListener("mouseenter", () => tooltipAnzeigen(button, eintrag));
      button.addEventListener("mouseleave", tooltipAusblenden);
      button.addEventListener("focus", () => tooltipAnzeigen(button, eintrag));
      button.addEventListener("blur", tooltipAusblenden);
    }

    calendarGrid.appendChild(button);
  }
}


function tooltipAnzeigen(button, eintrag) {
  const rect = button.getBoundingClientRect();
  const inhalt = tooltipInhalt(eintrag);

  dayTooltip.innerHTML = inhalt;
  dayTooltip.classList.add("visible");

  const tooltipBreite = 230;
  const abstand = 8;

  let links = rect.left + rect.width / 2 - tooltipBreite / 2;
  links = Math.max(8, Math.min(links, window.innerWidth - tooltipBreite - 8));

  const tooltipHoehe = dayTooltip.offsetHeight || 100;
  let oben = rect.top - tooltipHoehe - abstand;

  if (oben < 8) {
    oben = rect.bottom + abstand;
  }

  dayTooltip.style.left = `${links}px`;
  dayTooltip.style.top = `${oben}px`;
  dayTooltip.style.width = `${tooltipBreite}px`;
}

function tooltipAusblenden() {
  dayTooltip.classList.remove("visible");
}

function tooltipInhalt(eintrag) {
  const datumText = datumAusIso(eintrag.datum).toLocaleDateString("de-DE");
  const status = statusText(eintrag);
  const zeilen = [`<strong>${datumText}</strong>`];

  if (status) {
    zeilen.push(`<span class="day-tooltip-line">${status}</span>`);
  }

  if (Number(eintrag.stunden) > 0) {
    zeilen.push(
      `<span class="day-tooltip-line">${stundenFormatieren(eintrag.stunden)} Stunden</span>`
    );
  } else if (Number(eintrag.urlaub) > 0 || Number(eintrag.krank) > 0) {
    zeilen.push('<span class="day-tooltip-line">6 Stunden</span>');
  }

  if (eintrag.taetigkeit) {
    zeilen.push(`<span class="day-tooltip-line">${htmlSicher(eintrag.taetigkeit)}</span>`);
  }

  return zeilen.join("");
}

function stundenFormatieren(wert) {
  return Number(wert).toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function htmlSicher(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function statusKlasse(eintrag) {
  if (!eintrag) return "status-offen";
  if (Number(eintrag.urlaub) > 0) return "status-urlaub";
  if (Number(eintrag.krank) > 0) return "status-krank";

  const ort = String(eintrag.arbeitsort || "").toLowerCase();

  if (ort.includes("home")) return "status-homeoffice";
  if (ort.includes("büro")) return "status-buero";
  if (Number(eintrag.stunden) > 0) return "status-buero";

  return "status-offen";
}

function statusText(eintrag) {
  if (!eintrag) return "";
  if (Number(eintrag.urlaub) > 0) return "Urlaub";
  if (Number(eintrag.krank) > 0) return "Krank";

  const ort = String(eintrag.arbeitsort || "").toLowerCase();

  if (ort.includes("home")) return "HO";
  if (ort.includes("büro")) return "Büro";
  if (Number(eintrag.stunden) > 0) return "Arbeit";

  return "";
}

async function datumGeaendert() {
  if (!datum.value) return;

  state.ausgewaehltesDatum = datum.value;
  const neuesDatum = datumAusIso(datum.value);
  const monatGeaendert =
    neuesDatum.getFullYear() !== state.kalenderDatum.getFullYear() ||
    neuesDatum.getMonth() !== state.kalenderDatum.getMonth();

  state.kalenderDatum = new Date(
    neuesDatum.getFullYear(),
    neuesDatum.getMonth(),
    1
  );

  if (monatGeaendert) {
    await ladeMonat();
  } else {
    renderKalender();
  }
}

async function monatWechseln(richtung) {
  state.kalenderDatum = new Date(
    state.kalenderDatum.getFullYear(),
    state.kalenderDatum.getMonth() + richtung,
    1
  );

  state.ausgewaehltesDatum = toIsoDate(state.kalenderDatum);
  datum.value = state.ausgewaehltesDatum;
  await ladeMonat();
}

function jsonpRequest(parameter) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "azCallback" +
      Date.now() +
      Math.random().toString(36).slice(2);

    const script = document.createElement("script");

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Zeitüberschreitung beim Apps Script."));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[callbackName] = function(data) {
      cleanup();
      resolve(data);
    };

    const query = new URLSearchParams({
      ...parameter,
      callback: callbackName,
      zeit: Date.now()
    });

    script.src = SCRIPT_URL + "?" + query.toString();

    script.onerror = function() {
      cleanup();
      reject(new Error("Verbindung zum Apps Script fehlgeschlagen."));
    };

    document.head.appendChild(script);
  });
}

function renderTaetigkeiten(liste) {
  const bisherigerWert = taetigkeit.value;

  taetigkeit.innerHTML = '<option value="">Bitte wählen</option>';

  liste.forEach((eintrag) => {
    const option = document.createElement("option");
    option.value = eintrag;
    option.textContent = eintrag;
    taetigkeit.appendChild(option);
  });

  if (liste.includes(bisherigerWert)) {
    taetigkeit.value = bisherigerWert;
  }
}

function setzeHeute() {
  datum.value = toIsoDate(new Date());
}

function toIsoDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function datumAusIso(iso) {
  const [jahr, monat, tag] = String(iso).split("-").map(Number);
  return new Date(jahr, monat - 1, tag);
}

function handleAbwesenheit() {
  const istAbwesend =
    urlaub.value === "Ja" ||
    krank.value === "Ja";

  arbeitsort.disabled = istAbwesend;
  taetigkeit.disabled = istAbwesend;
  stunden.disabled = istAbwesend;

  if (istAbwesend) {
    arbeitsort.value = "";
    taetigkeit.value = "";
    stunden.value = "";
  }
}

function validiere(daten) {
  if (!daten.datum) return "Bitte Datum auswählen.";

  if (
    daten.urlaub === "Ja" &&
    daten.krank === "Ja"
  ) {
    return "Bitte nur Urlaub oder Krank wählen.";
  }

  if (
    daten.urlaub !== "Ja" &&
    daten.krank !== "Ja"
  ) {
    if (!daten.arbeitsort) return "Bitte Arbeitsort auswählen.";
    if (!daten.taetigkeit) return "Bitte Tätigkeit auswählen.";

    const wert = Number(daten.stunden);

    if (
      !Number.isFinite(wert) ||
      wert <= 0 ||
      wert > 6
    ) {
      return "Bitte gültige Stunden zwischen 0,25 und 6 eintragen.";
    }
  }

  return "";
}

function zeigeMeldung(text, klasse) {
  meldung.textContent = text;
  meldung.className = klasse || "";
}
