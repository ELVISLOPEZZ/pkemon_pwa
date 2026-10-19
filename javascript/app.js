
/* =========================================
   REGISTRO DEL SERVICE WORKER
========================================= */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('../servicesworker.js')
            .then(reg => {
                console.log('Service Worker registrado con éxito:', reg);
            })
            .catch(err => {
                console.error('Fallo al registrar el Service Worker:', err);
            });
    });
}

/* =========================================
   TRADUCCIÓN DE TIPOS
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

/* =========================================
   CONFIGURACIÓN
========================================= */

const container = document.getElementById('pokemon-container');
const TOTAL_POKEMON = 151;
const API_URL = 'https://pokeapi.co/api/v2/pokemon?limit=151&offset=0';

/* =========================================
   CARGAR LOS 151 POKÉMON
========================================= */

async function fetchAllPokemons() {
    if (!container) {
        console.error('No se encontró el elemento pokemon-container.');
        return;
    }

    container.innerHTML = `
        <p class="loading">
            Cargando los 151 Pokémon de Kanto...
        </p>
    `;

    try {
        // Obtener la lista de los primeros 151 Pokémon
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error('No se pudo obtener la lista de Pokémon.');
        }

        const data = await response.json();
        const allPokemons = [];

        // Cargar en grupos de 10 Pokémon
        for (let i = 0; i < data.results.length; i += 10) {
            const batch = data.results.slice(i, i + 10);

            const results = await Promise.all(
                batch.map(async (item) => {
                    const cacheKey = `pokemon_${item.name}`;

                    // Intentar cargar cada Pokémon hasta 3 veces
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            const res = await fetch(item.url);

                            if (!res.ok) {
                                throw new Error(`HTTP ${res.status}`);
                            }

                            const pokemon = await res.json();

                            // Guardar los datos para usarlos sin conexión
                            try {
                                localStorage.setItem(
                                    cacheKey,
                                    JSON.stringify(pokemon)
                                );
                            } catch (storageError) {
                                console.warn(
                                    'No se pudo guardar en localStorage:',
                                    storageError
                                );
                            }

                            return pokemon;

                        } catch (error) {
                            console.warn(
                                `Intento ${attempt}/3 para ${item.name}:`,
                                error
                            );

                            // Esperar un poco antes de volver a intentar
                            if (attempt < 3) {
                                await new Promise(resolve =>
                                    setTimeout(resolve, 500 * attempt)
                                );
                            }
                        }
                    }

                    // Si fallaron las peticiones, usar los datos guardados
                    try {
                        const cached = localStorage.getItem(cacheKey);

                        if (cached) {
                            return JSON.parse(cached);
                        }
                    } catch (error) {
                        console.error(
                            `Error al recuperar ${item.name}:`,
                            error
                        );
                    }

                    return null;
                })
            );

            allPokemons.push(...results.filter(Boolean));

            // Mostrar el progreso de carga
            container.innerHTML = `
                <p class="loading">
                    Cargando Pokémon:
                    ${Math.min(i + batch.length, TOTAL_POKEMON)}
                    de ${TOTAL_POKEMON}...
                </p>
            `;
        }

        // Recuperar Pokémon faltantes desde localStorage
        const loadedIds = new Set(allPokemons.map(p => p.id));

        for (let id = 1; id <= TOTAL_POKEMON; id++) {
            if (!loadedIds.has(id)) {
                const cached = findCachedPokemon(id);

                if (cached) {
                    allPokemons.push(cached);
                    loadedIds.add(id);
                }
            }
        }

        // Eliminar duplicados y ordenar del 1 al 151
        const uniquePokemons = [
            ...new Map(
                allPokemons.map(pokemon => [pokemon.id, pokemon])
            ).values()
        ].sort((a, b) => a.id - b.id);

        // Dibujar las tarjetas
        container.innerHTML = '';

        uniquePokemons.forEach(pokemon => {
            renderCard(pokemon);
        });

        // Avisar si faltan Pokémon
        if (uniquePokemons.length < TOTAL_POKEMON) {
            const message = document.createElement('p');

            message.className = 'error-msg';
            message.textContent =
                `Se cargaron ${uniquePokemons.length} de 151 Pokémon. ` +
                'Comprueba tu conexión y vuelve a intentarlo.';

            container.prepend(message);
        }

        console.log(
            `Pokémon cargados: ${uniquePokemons.length} de ${TOTAL_POKEMON}`
        );

    } catch (error) {
        console.error('Error al cargar desde la API:', error);

        loadPokemonsOffline();
    }
}

/* =========================================
   BUSCAR POKÉMON GUARDADO POR NÚMERO
========================================= */

function findCachedPokemon(id) {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key && key.startsWith('pokemon_')) {
            try {
                const pokemon = JSON.parse(localStorage.getItem(key));

                if (pokemon && pokemon.id === id) {
                    return pokemon;
                }
            } catch (error) {
                console.error(
                    `Error al leer los datos guardados (${key}):`,
                    error
                );
            }
        }
    }

    return null;
}

/* =========================================
   CARGAR POKÉMON SIN CONEXIÓN
========================================= */

function loadPokemonsOffline() {
    if (!container) return;

    container.innerHTML = '';

    const allPokemons = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key && key.startsWith('pokemon_')) {
            try {
                const pokemon = JSON.parse(localStorage.getItem(key));

                if (
                    pokemon &&
                    pokemon.id >= 1 &&
                    pokemon.id <= TOTAL_POKEMON
                ) {
                    allPokemons.push(pokemon);
                }
            } catch (error) {
                console.error('Error al leer Pokémon guardado:', error);
            }
        }
    }

    // Eliminar duplicados y ordenar
    const uniquePokemons = [
        ...new Map(
            allPokemons.map(pokemon => [pokemon.id, pokemon])
        ).values()
    ].sort((a, b) => a.id - b.id);

    if (uniquePokemons.length === 0) {
        container.innerHTML = `
            <p class="error-msg">
                No hay conexión a internet y todavía no hay Pokémon guardados.
                Conéctate a internet para cargar los datos.
            </p>
        `;

        return;
    }

    uniquePokemons.forEach(pokemon => {
        renderCard(pokemon);
    });

    if (uniquePokemons.length < TOTAL_POKEMON) {
        const message = document.createElement('p');

        message.className = 'error-msg';
        message.textContent =
            `Modo sin conexión: hay ${uniquePokemons.length} de 151 Pokémon guardados.`;

        container.prepend(message);
    }

    console.log(
        `Modo sin conexión: ${uniquePokemons.length} de 151 Pokémon disponibles`
    );
}

/* =========================================
   CREAR TARJETA DEL POKÉMON
========================================= */

function renderCard(pokemon) {
    const card = document.createElement('div');

    card.classList.add('card');

    // Abrir el detalle del Pokémon al hacer clic
    card.addEventListener('click', () => {
        window.location.href =
            `./javascript/detalle.html?name=${encodeURIComponent(pokemon.name)}`;
    });

    const capitalizedName =
        pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1);

    const imageSrc =
        pokemon.sprites?.other?.['official-artwork']?.front_default ||
        pokemon.sprites?.front_default ||
        '';

    const formattedId =
        `N.º ${pokemon.id.toString().padStart(4, '0')}`;

    // Generar las etiquetas de tipos
    let typesHTML = '';

    if (pokemon.types) {
        pokemon.types.forEach(t => {
            const typeKey = t.type.name;

            const typeNameEs =
                typeTranslations[typeKey] || typeKey.toUpperCase();

            typesHTML += `
                <span class="type-badge ${typeKey}">
                    ${typeNameEs}
                </span>
            `;
        });
    }

    card.innerHTML = `
        <img
            src="${imageSrc}"
            alt="${capitalizedName}"
            class="card-img"
            loading="lazy"
        >

        <div class="card-body">
            <span class="pokemon-id">${formattedId}</span>

            <h3 class="card-title">${capitalizedName}</h3>

            <div class="types-container">
                ${typesHTML}
            </div>
        </div>
    `;

    // Usar el sprite normal si falla la imagen principal
    const img = card.querySelector('.card-img');

    img.addEventListener('error', () => {
        if (img.dataset.fallbackUsed === 'true') {
            img.style.display = 'none';
            return;
        }

        img.dataset.fallbackUsed = 'true';

        const fallback =
            pokemon.sprites?.front_default || '';

        if (fallback && img.src !== fallback) {
            img.src = fallback;
        } else {
            img.style.display = 'none';
        }
    });

    container.appendChild(card);
}

/* =========================================
   INICIAR LA APLICACIÓN
========================================= */

document.addEventListener('DOMContentLoaded', fetchAllPokemons);