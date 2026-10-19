
const API_BASE = "https://pokeapi.co/api/v2";

const TYPE_TRANSLATIONS = {
    normal: "Normal",
    fire: "Fuego",
    water: "Agua",
    electric: "Eléctrico",
    grass: "Planta",
    ice: "Hielo",
    fighting: "Lucha",
    poison: "Veneno",
    ground: "Tierra",
    flying: "Volador",
    psychic: "Psíquico",
    bug: "Bicho",
    rock: "Roca",
    ghost: "Fantasma",
    dragon: "Dragón",
    dark: "Siniestro",
    steel: "Acero",
    fairy: "Hada"
};

const STAT_TRANSLATIONS = {
    hp: { label: "PS", number: "num-hp", bar: "bar-hp" },
    attack: { label: "Ataque", number: "num-attack", bar: "bar-attack" },
    defense: { label: "Defensa", number: "num-defense", bar: "bar-defense" },
    "special-attack": {
        label: "At. Esp.",
        number: "num-sp-atk",
        bar: "bar-sp-atk"
    },
    "special-defense": {
        label: "Def. Esp.",
        number: "num-sp-def",
        bar: "bar-sp-def"
    },
    speed: { label: "Velocidad", number: "num-speed", bar: "bar-speed" }
};

async function fetchJSON(url, attempts = 3) {
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}: ${url}`);
            }

            return await response.json();
        } catch (error) {
            lastError = error;

            if (attempt < attempts) {
                await new Promise(resolve =>
                    setTimeout(resolve, 500 * attempt)
                );
            }
        }
    }

    throw lastError;
}

function getPokemonName() {
    const params = new URLSearchParams(window.location.search);
    const name = params.get("pokemon") || params.get("name") || params.get("id");

    return name ? name.trim().toLowerCase() : null;
}

function getDisplayName(name) {
    return name
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function getCachedPokemon(name) {
    try {
        const cached = localStorage.getItem(`pokemon_${name}`);
        return cached ? JSON.parse(cached) : null;
    } catch (error) {
        console.warn("No se pudo leer el Pokémon guardado:", error);
        return null;
    }
}

function saveCachedPokemon(name, data) {
    try {
        localStorage.setItem(`pokemon_${name}`, JSON.stringify(data));
    } catch (error) {
        console.warn("No se pudo guardar el Pokémon en caché:", error);
    }
}

async function getPokemon(identifier) {
    const cached = getCachedPokemon(identifier);

    try {
        const pokemon = await fetchJSON(
            `${API_BASE}/pokemon/${encodeURIComponent(identifier)}`
        );

        saveCachedPokemon(pokemon.name, pokemon);

        if (identifier !== pokemon.name) {
            saveCachedPokemon(identifier, pokemon);
        }

        return pokemon;
    } catch (error) {
        if (cached) {
            console.warn("Se utilizarán los datos guardados sin conexión.");
            return cached;
        }

        throw error;
    }
}

function renderPokemonImage(pokemon) {
    const image = document.getElementById("detail-img");

    if (!image) return;

    const artwork =
        pokemon.sprites?.other?.["official-artwork"]?.front_default ||
        pokemon.sprites?.other?.home?.front_default ||
        pokemon.sprites?.front_default;

    if (artwork) {
        image.src = artwork;
        image.alt = getDisplayName(pokemon.name);
    } else {
        image.alt = "Imagen no disponible";
    }

    image.onerror = () => {
        image.onerror = null;
        image.src = pokemon.sprites?.front_default || "";
    };
}

function renderTypes(pokemon) {
    const container = document.getElementById("detail-types");

    if (!container) return;

    container.replaceChildren();

    pokemon.types.forEach(item => {
        const typeName = item.type.name;
        const typeElement = document.createElement("span");

        typeElement.className = `type-badge type-${typeName}`;
        typeElement.textContent =
            TYPE_TRANSLATIONS[typeName] || getDisplayName(typeName);

        container.appendChild(typeElement);
    });
}

function renderStats(pokemon) {
    pokemon.stats.forEach(item => {
        const config = STAT_TRANSLATIONS[item.stat.name];

        if (!config) return;

        const value = item.base_stat;
        const numberElement = document.getElementById(config.number);
        const barElement = document.getElementById(config.bar);

        if (numberElement) {
            numberElement.textContent = value;
        }

        if (barElement) {
            const percentage = Math.min((value / 255) * 100, 100);

            barElement.style.height = `${percentage}%`;
            barElement.style.width = "100%";
            barElement.setAttribute("role", "progressbar");
            barElement.setAttribute("aria-valuenow", value);
            barElement.setAttribute("aria-valuemin", "0");
            barElement.setAttribute("aria-valuemax", "255");
            barElement.setAttribute(
                "aria-label",
                `${config.label}: ${value}`
            );
        }
    });
}

async function getPokemonSpecies(pokemon) {
    if (!pokemon.species?.url) return null;

    try {
        return await fetchJSON(pokemon.species.url);
    } catch (error) {
        console.warn("No se pudo cargar la información de la especie:", error);
        return null;
    }
}

function getSpanishDescription(species) {
    if (!species?.flavor_text_entries) {
        return "No hay una descripción disponible.";
    }

    const entry =
        species.flavor_text_entries.find(
            item => item.language.name === "es"
        ) ||
        species.flavor_text_entries.find(
            item => item.language.name === "en"
        );

    if (!entry) {
        return "No hay una descripción disponible.";
    }

    return entry.flavor_text
        .replace(/[\n\f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function renderDescription(species) {
    const description = document.getElementById("detail-description");

    if (description) {
        description.textContent = getSpanishDescription(species);
    }

    const categoryElement = document.getElementById("detail-category");

    if (categoryElement && species?.genera) {
        const genus =
            species.genera.find(item => item.language.name === "es") ||
            species.genera.find(item => item.language.name === "en");

        if (genus) {
            categoryElement.textContent = genus.genus;
        }
    }
}

function renderPhysicalData(pokemon) {
    const heightElement = document.getElementById("detail-height");
    const weightElement = document.getElementById("detail-weight");
    const abilityElement = document.getElementById("detail-ability");

    if (heightElement) {
        heightElement.textContent = `${(pokemon.height / 10).toFixed(1)} m`;
    }

    if (weightElement) {
        weightElement.textContent = `${(pokemon.weight / 10).toFixed(1)} kg`;
    }

    if (abilityElement) {
        const abilities = pokemon.abilities.map(item =>
            getDisplayName(item.ability.name)
        );

        abilityElement.textContent = abilities.join(", ") || "No disponible";
    }
}

/* =========================
   EVOLUCIONES POKÉMON
========================= */

async function getEvolutionChain(species) {
    if (!species?.evolution_chain?.url) return null;

    try {
        return await fetchJSON(species.evolution_chain.url);
    } catch (error) {
        console.warn("No se pudo cargar la cadena evolutiva:", error);
        return null;
    }
}

// Obtiene todas las evoluciones, incluidas las ramas, sin duplicarlas.
function collectEvolutionNames(chain, results = []) {
    if (!chain) return results;

    const name = chain.species?.name;

    if (name && !results.includes(name)) {
        results.push(name);
    }

    if (Array.isArray(chain.evolves_to)) {
        chain.evolves_to.forEach(evolution => {
            collectEvolutionNames(evolution, results);
        });
    }

    return results;
}

// Obtiene el ID del Pokémon para cargar su ilustración oficial.
async function getPokemonId(name) {
    const cached = getCachedPokemon(name);

    if (cached?.id) {
        return cached.id;
    }

    try {
        const pokemon = await fetchJSON(
            `${API_BASE}/pokemon/${encodeURIComponent(name)}`
        );

        saveCachedPokemon(name, pokemon);
        return pokemon.id;
    } catch (error) {
        console.warn(`No se pudo obtener el ID de ${name}:`, error);
        return null;
    }
}

async function createEvolutionCard(name, currentPokemonName) {
    const item = document.createElement("button");

    item.type = "button";
    item.className = "evolution-item";
    item.setAttribute("aria-label", `Ver a ${getDisplayName(name)}`);

    if (name === currentPokemonName) {
        item.classList.add("current-evolution");
        item.setAttribute("aria-current", "true");
    }

    const image = document.createElement("img");
    image.alt = getDisplayName(name);
    image.loading = "lazy";

    const pokemonId = await getPokemonId(name);

    if (pokemonId) {
        image.src =
            `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;
    } else {
        image.alt = `Imagen de ${getDisplayName(name)} no disponible`;
    }

    image.onerror = () => {
        image.onerror = null;

        if (pokemonId) {
            image.src =
                `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
        }
    };

    const label = document.createElement("span");
    label.textContent = getDisplayName(name);

    item.append(image, label);

    item.addEventListener("click", () => {
        const url = new URL(window.location.href);

        url.searchParams.set("pokemon", name);
        url.searchParams.delete("name");
        url.searchParams.delete("id");

        window.location.href = url.toString();
    });

    return item;
}

async function renderEvolutions(species, currentPokemonName) {
    const container = document.getElementById("evolution-container");

    if (!container) return;

    container.replaceChildren();

    const chainData = await getEvolutionChain(species);

    if (!chainData?.chain) {
        container.textContent = "No se pudieron cargar las evoluciones.";
        return;
    }

    const evolutionNames = collectEvolutionNames(chainData.chain);

    if (evolutionNames.length <= 1) {
        container.textContent = "Este Pokémon no tiene evoluciones.";
        return;
    }

    // Conserva el orden de la cadena y muestra todas las ramas.
    const fragment = document.createDocumentFragment();

    for (const name of evolutionNames) {
        const card = await createEvolutionCard(name, currentPokemonName);
        fragment.appendChild(card);
    }

    container.appendChild(fragment);
}

/* =========================
   NOMBRE Y CARGA DE PÁGINA
========================= */

function renderPokemonName(pokemon) {
    const title =
        document.getElementById("detail-name") ||
        document.getElementById("pokemon-name") ||
        document.querySelector(".card-header-title h1") ||
        document.querySelector(".card-header-title");

    if (title) {
        title.textContent = getDisplayName(pokemon.name);
    }

    const numberElement = document.getElementById("detail-number");

    if (numberElement) {
        numberElement.textContent =
            `N.º ${String(pokemon.id).padStart(3, "0")}`;
    }

    document.title = `${getDisplayName(pokemon.name)} | Pokédex`;
}

function showError(message) {
    const container =
        document.getElementById("official-detail-container") ||
        document.querySelector("main") ||
        document.body;

    const errorElement = document.createElement("p");

    errorElement.className = "error-message";
    errorElement.textContent = message;

    container.prepend(errorElement);
}

async function initDetailPage() {
    const identifier = getPokemonName();

    if (!identifier) {
        showError(
            "No se indicó qué Pokémon mostrar. Regresa a la Pokédex y selecciona uno."
        );
        return;
    }

    try {
        const pokemon = await getPokemon(identifier);

        renderPokemonName(pokemon);
        renderPokemonImage(pokemon);
        renderTypes(pokemon);
        renderStats(pokemon);
        renderPhysicalData(pokemon);

        const species = await getPokemonSpecies(pokemon);

        renderDescription(species);
        await renderEvolutions(species, pokemon.name);
    } catch (error) {
        console.error("Error al cargar los detalles del Pokémon:", error);

        showError(
            "No se pudieron cargar los datos del Pokémon. Comprueba tu conexión e inténtalo de nuevo."
        );
    }
}

document.addEventListener("DOMContentLoaded", initDetailPage);
