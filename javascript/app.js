/* =========================================
   INSTALACIÓN PERSONALIZADA DE LA PWA
========================================= */

let deferredInstallPrompt = null;
const installButton = document.getElementById("install-button");

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) installButton.hidden = false;
});

if (installButton) {
    installButton.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;

        const installPrompt = deferredInstallPrompt;
        deferredInstallPrompt = null;
        installButton.disabled = true;

        try {
            await installPrompt.prompt();
            const result = await installPrompt.userChoice;
            console.log(
                result.outcome === "accepted"
                    ? "El usuario aceptó instalar la PWA."
                    : "El usuario canceló la instalación."
            );
            installButton.hidden = true;
        } catch (error) {
            console.error("Error durante la instalación:", error);
        } finally {
            installButton.disabled = false;
        }
    });
}

window.addEventListener("appinstalled", () => {
    console.log("Pokédex PWA instalada correctamente.");
    if (installButton) installButton.hidden = true;
    deferredInstallPrompt = null;
});

const isAppInstalled =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

if (isAppInstalled && installButton) installButton.hidden = true;


/* =========================================
   CONFIGURACIÓN Y TRADUCCIÓN DE TIPOS
========================================= */

const typeTranslations = {
    grass: "Planta",
    poison: "Veneno",
    fire: "Fuego",
    water: "Agua",
    electric: "Eléctrico",
    bug: "Bicho",
    normal: "Normal",
    flying: "Volador",
    ground: "Tierra",
    rock: "Roca",
    fighting: "Lucha",
    psychic: "Psíquico",
    ghost: "Fantasma",
    ice: "Hielo",
    dragon: "Dragón",
    dark: "Siniestro",
    steel: "Acero",
    fairy: "Hada"
};

const container = document.getElementById("pokemon-container");
const searchInput = document.getElementById("pokemon-search");
const clearSearchButton = document.getElementById("clear-search");
const resetFiltersButton = document.getElementById("reset-filters");
const filterChipsContainer = document.getElementById("filter-chips");
const resultsCount = document.getElementById("results-count");

const TOTAL_POKEMON = 151;
const API_URL = "https://pokeapi.co/api/v2/pokemon?limit=151&offset=0";

let allPokemonsData = [];
let selectedType = "all";
let loadingErrorMessage = "";


/* =========================================
   BUSCADOR Y FILTROS
========================================= */

function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function getPokemonNumberFromSearch(value) {
    const cleaned = String(value).trim().replace(/^#/, "");
    if (!cleaned || !/^\d+$/.test(cleaned)) return null;
    return Number(cleaned);
}

function getFilteredPokemons() {
    const query = normalizeText(searchInput?.value ?? "");
    const searchedNumber = getPokemonNumberFromSearch(searchInput?.value ?? "");

    return allPokemonsData.filter((pokemon) => {
        const nameMatches =
            !query || normalizeText(pokemon.name).includes(query);

        const numberMatches =
            searchedNumber === null ||
            String(pokemon.id) === String(searchedNumber);

        const typeMatches =
            selectedType === "all" ||
            (pokemon.types || []).some((item) => item.type?.name === selectedType);

        // Si el usuario escribió un número, se prioriza la coincidencia por número.
        const searchMatches = searchedNumber !== null
            ? numberMatches
            : nameMatches;

        return searchMatches && typeMatches;
    });
}

function updateResultsCount(filteredCount) {
    if (!resultsCount) return;

    const total = allPokemonsData.length;
    if (total === 0) {
        resultsCount.textContent = loadingErrorMessage || "No se pudieron cargar los Pokémon.";
        return;
    }

    if (filteredCount === total && selectedType === "all" && !(searchInput?.value || "").trim()) {
        resultsCount.textContent = `Mostrando ${total} Pokémon`;
    } else {
        resultsCount.textContent = `Se encontraron ${filteredCount} de ${total} Pokémon`;
    }
}

function updateActiveChip() {
    if (!filterChipsContainer) return;

    filterChipsContainer.querySelectorAll(".filter-chip").forEach((chip) => {
        const isActive = chip.dataset.type === selectedType;
        chip.classList.toggle("active", isActive);
        chip.setAttribute("aria-pressed", String(isActive));
    });
}

function renderFilteredPokemons() {
    if (!container) return;

    const filteredPokemons = getFilteredPokemons();
    container.innerHTML = "";

    if (filteredPokemons.length === 0) {
        const message = document.createElement("p");
        message.className = "no-results";
        message.textContent = allPokemonsData.length
            ? "No se encontraron Pokémon con esa búsqueda o filtro. Prueba con otro nombre o tipo."
            : (loadingErrorMessage || "No hay Pokémon disponibles.");
        container.appendChild(message);
    } else {
        const fragment = document.createDocumentFragment();
        filteredPokemons.forEach((pokemon) => {
            fragment.appendChild(createPokemonCard(pokemon));
        });
        container.appendChild(fragment);
    }

    updateResultsCount(filteredPokemons.length);

    if (clearSearchButton) {
        clearSearchButton.hidden = !(searchInput?.value || "").length;
    }
}

function handleSearchInput() {
    renderFilteredPokemons();
}

if (searchInput) {
    searchInput.addEventListener("input", handleSearchInput);
}

if (clearSearchButton) {
    clearSearchButton.addEventListener("click", () => {
        if (searchInput) {
            searchInput.value = "";
            searchInput.focus();
        }
        renderFilteredPokemons();
    });
}

if (filterChipsContainer) {
    filterChipsContainer.addEventListener("click", (event) => {
        const chip = event.target.closest(".filter-chip");
        if (!chip || !filterChipsContainer.contains(chip)) return;

        selectedType = chip.dataset.type || "all";
        updateActiveChip();
        renderFilteredPokemons();
    });
}

if (resetFiltersButton) {
    resetFiltersButton.addEventListener("click", () => {
        selectedType = "all";
        if (searchInput) searchInput.value = "";
        updateActiveChip();
        renderFilteredPokemons();
    });
}


/* =========================================
   CARGAR LOS 151 POKÉMON
========================================= */

async function fetchAllPokemons() {
    if (!container) {
        console.error("No se encontró el elemento pokemon-container.");
        return;
    }

    container.innerHTML = '<p class="loading">Cargando los 151 Pokémon de Kanto...</p>';
    if (resultsCount) resultsCount.textContent = "Cargando Pokémon...";

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("No se pudo obtener la lista de Pokémon.");

        const data = await response.json();
        const allPokemons = [];

        // Se cargan en grupos de 10 para no saturar las solicitudes.
        for (let i = 0; i < data.results.length; i += 10) {
            const batch = data.results.slice(i, i + 10);

            const results = await Promise.all(
                batch.map(async (item) => {
                    const cacheKey = `pokemon_${item.name}`;

                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            const res = await fetch(item.url);
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);

                            const pokemon = await res.json();

                            try {
                                localStorage.setItem(cacheKey, JSON.stringify(pokemon));
                            } catch (storageError) {
                                console.warn("No se pudo guardar en localStorage:", storageError);
                            }

                            return pokemon;
                        } catch (error) {
                            console.warn(`Intento ${attempt}/3 para ${item.name}:`, error);
                            if (attempt < 3) {
                                await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
                            }
                        }
                    }

                    try {
                        const cached = localStorage.getItem(cacheKey);
                        if (cached) return JSON.parse(cached);
                    } catch (error) {
                        console.error(`Error al recuperar ${item.name}:`, error);
                    }

                    return null;
                })
            );

            allPokemons.push(...results.filter(Boolean));

            if (resultsCount) {
                resultsCount.textContent =
                    `Cargando Pokémon: ${Math.min(i + batch.length, TOTAL_POKEMON)} de ${TOTAL_POKEMON}...`;
            }
        }

        const loadedIds = new Set(allPokemons.map((pokemon) => pokemon.id));

        // Recuperar de caché los Pokémon que no se pudieron descargar.
        for (let id = 1; id <= TOTAL_POKEMON; id++) {
            if (!loadedIds.has(id)) {
                const cached = findCachedPokemon(id);
                if (cached) {
                    allPokemons.push(cached);
                    loadedIds.add(id);
                }
            }
        }

        allPokemonsData = [
            ...new Map(allPokemons.map((pokemon) => [pokemon.id, pokemon])).values()
        ].sort((a, b) => a.id - b.id);

        loadingErrorMessage = allPokemonsData.length < TOTAL_POKEMON
            ? `Se cargaron ${allPokemonsData.length} de 151 Pokémon. Comprueba tu conexión.`
            : "";

        updateActiveChip();
        renderFilteredPokemons();

        if (allPokemonsData.length < TOTAL_POKEMON) {
            console.warn(loadingErrorMessage);
        }

        console.log(`Pokémon cargados: ${allPokemonsData.length} de ${TOTAL_POKEMON}`);
    } catch (error) {
        console.error("Error al cargar desde la API:", error);
        loadPokemonsOffline();
    }
}


/* =========================================
   BUSCAR POKÉMON GUARDADO POR NÚMERO
========================================= */

function findCachedPokemon(id) {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith("pokemon_")) continue;

            try {
                const pokemon = JSON.parse(localStorage.getItem(key));
                if (pokemon && pokemon.id === id) return pokemon;
            } catch (error) {
                console.error(`Error al leer los datos guardados (${key}):`, error);
            }
        }
    } catch (error) {
        console.warn("No se pudo consultar localStorage:", error);
    }
    return null;
}


/* =========================================
   CARGAR POKÉMON SIN CONEXIÓN
========================================= */

function loadPokemonsOffline() {
    if (!container) return;

    const cachedPokemons = [];

    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith("pokemon_")) continue;

            try {
                const pokemon = JSON.parse(localStorage.getItem(key));
                if (pokemon && pokemon.id >= 1 && pokemon.id <= TOTAL_POKEMON) {
                    cachedPokemons.push(pokemon);
                }
            } catch (error) {
                console.error("Error al leer Pokémon guardado:", error);
            }
        }
    } catch (error) {
        console.warn("No se pudo acceder a localStorage:", error);
    }

    allPokemonsData = [
        ...new Map(cachedPokemons.map((pokemon) => [pokemon.id, pokemon])).values()
    ].sort((a, b) => a.id - b.id);

    if (allPokemonsData.length === 0) {
        loadingErrorMessage =
            "No hay conexión a internet y todavía no hay Pokémon guardados. Conéctate para cargar los datos.";
        container.innerHTML = `<p class="error-msg">${loadingErrorMessage}</p>`;
        if (resultsCount) resultsCount.textContent = loadingErrorMessage;
        return;
    }

    loadingErrorMessage = `Modo sin conexión: hay ${allPokemonsData.length} de 151 Pokémon guardados.`;
    updateActiveChip();
    renderFilteredPokemons();
    console.log(loadingErrorMessage);
}


/* =========================================
   CREAR TARJETA DEL POKÉMON
========================================= */

function createPokemonCard(pokemon) {
    const card = document.createElement("article");
    card.classList.add("card");
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", `Ver detalles de ${pokemon.name}`);

    const openDetails = () => {
        window.location.href =
            `./javascript/detalle.html?name=${encodeURIComponent(pokemon.name)}`;
    };

    card.addEventListener("click", openDetails);
    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDetails();
        }
    });

    const capitalizedName =
        pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1);

    const imageSrc =
        pokemon.sprites?.other?.["official-artwork"]?.front_default ||
        pokemon.sprites?.front_default ||
        "";

    const formattedId = `N.º ${String(pokemon.id).padStart(4, "0")}`;

    const cardImage = document.createElement("img");
    cardImage.src = imageSrc;
    cardImage.alt = capitalizedName;
    cardImage.className = "card-img";
    cardImage.loading = "lazy";
    cardImage.addEventListener("error", () => {
        const fallback = pokemon.sprites?.front_default || "";
        if (fallback && cardImage.src !== fallback && !cardImage.dataset.fallbackUsed) {
            cardImage.dataset.fallbackUsed = "true";
            cardImage.src = fallback;
        } else {
            cardImage.style.visibility = "hidden";
        }
    });

    const cardBody = document.createElement("div");
    cardBody.className = "card-body";

    const idLabel = document.createElement("span");
    idLabel.className = "pokemon-id";
    idLabel.textContent = formattedId;

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = capitalizedName;

    const typesContainer = document.createElement("div");
    typesContainer.className = "types-container";

    (pokemon.types || []).forEach((item) => {
        const typeKey = item.type.name;
        const badge = document.createElement("span");
        badge.className = `type-badge ${typeKey}`;
        badge.textContent = typeTranslations[typeKey] || typeKey;
        typesContainer.appendChild(badge);
    });

    cardBody.append(idLabel, title, typesContainer);
    card.append(cardImage, cardBody);

    return card;
}


/* =========================================
   INICIAR LA APLICACIÓN
========================================= */

document.addEventListener("DOMContentLoaded", fetchAllPokemons);
