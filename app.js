const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbykN76RiOVXfU28zYFmlh-t94mYXB7t6cD9bwKkVv91ZZ70j37TafrPTbcZKSKflserpg/exec";

const form = document.getElementById("entryForm");
const datum = document.getElementById("datum");
const arbeitsort = document.getElementById("arbeitsort");
const taetigkeit = document.getElementById("taetigkeit");
const stunden = document.getElementById("stunden");
const urlaub = document.getElementById("urlaub");
const krank = document.getElementById("krank");
const saveButton = document.getElementById("saveButton");
const meldung = document.getElementById("meldung");

window.addEventListener("load", init);
form.addEventListener("submit", speichern);

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
  handleAbwesenheit();

  try {
    zeigeMeldung("Lade Tätigkeiten ...", "");

    const heute = new Date();
    const data = await jsonpRequest({
      action: "init",
      jahr: heute.getFullYear(),
      monat: heute.getMonth() + 1
    });

    if (!data.ok) {
      throw new Error(data.message || "Tätigkeiten konnten nicht geladen werden.");
    }

    renderTaetigkeiten(data.taetigkeiten || []);
    zeigeMeldung("", "");
  } catch (err) {
    zeigeMeldung("Fehler: " + err.message, "error");
  }
}

async function speichern(event) {
  event.preventDefault();

  const daten = {
    datum: datum.value,
    arbeitsort: arbeitsort.value,
    taetigkeit: taetigkeit.value,
    stunden: stunden.value,
    urlaub: urlaub.value,
    krank: krank.value
  };

  const fehler = validiere(daten);

  if (fehler) {
    zeigeMeldung(fehler, "error");
    return;
  }

  saveButton.disabled = true;
  zeigeMeldung("Speichere ...", "");

  try {
    const data = await jsonpRequest({
      action: "save",
      payload: JSON.stringify(daten)
    });

    if (!data.ok) {
      throw new Error(data.message || "Speichern fehlgeschlagen.");
    }

    zeigeMeldung(data.message || "Gespeichert ✅", "success");
    formularZuruecksetzen();
  } catch (err) {
    zeigeMeldung("Fehler: " + err.message, "error");
  } finally {
    saveButton.disabled = false;
  }
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
  taetigkeit.innerHTML = '<option value="">Bitte wählen</option>';

  liste.forEach((eintrag) => {
    const option = document.createElement("option");
    option.value = eintrag;
    option.textContent = eintrag;
    taetigkeit.appendChild(option);
  });
}

function setzeHeute() {
  const heute = new Date();
  const yyyy = heute.getFullYear();
  const mm = String(heute.getMonth() + 1).padStart(2, "0");
  const dd = String(heute.getDate()).padStart(2, "0");

  datum.value = `${yyyy}-${mm}-${dd}`;
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
  if (!daten.datum) {
    return "Bitte Datum auswählen.";
  }

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
    if (!daten.arbeitsort) {
      return "Bitte Arbeitsort auswählen.";
    }

    if (!daten.taetigkeit) {
      return "Bitte Tätigkeit auswählen.";
    }

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

function formularZuruecksetzen() {
  setzeHeute();
  arbeitsort.value = "";
  taetigkeit.value = "";
  stunden.value = "";
  urlaub.value = "Nein";
  krank.value = "Nein";
  handleAbwesenheit();
}

function zeigeMeldung(text, klasse) {
  meldung.textContent = text;
  meldung.className = klasse || "";
}
