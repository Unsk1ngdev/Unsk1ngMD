'use strict';

const fs = require('fs-extra');
const path = require('path');
const economy = require('./economy');
const logger = require('./logger');

const RPG_DB_PATH = path.join(__dirname, '../database/rpg.json');

// Definición de ítems del sistema RPG
const RPG_ITEMS = {
    // Minerales
    roca: { id: 'roca', nombre: 'Roca Común 🪨', tipo: 'mineral', valor: 25 },
    hierro: { id: 'hierro', nombre: 'Lingote de Hierro ⛓️', tipo: 'mineral', valor: 150 },
    oro: { id: 'oro', nombre: 'Lingote de Oro 🪙', tipo: 'mineral', valor: 450 },
    diamante: { id: 'diamante', nombre: 'Diamante Puro 💎', tipo: 'mineral', valor: 1200 },
    esmeralda: { id: 'esmeralda', nombre: 'Esmeralda Mística ❇️', tipo: 'mineral', valor: 2500 },

    // Maderas
    madera_comun: { id: 'madera_comun', nombre: 'Madera Común 🪵', tipo: 'madera', valor: 30 },
    roble: { id: 'roble', nombre: 'Tronco de Roble 🌲', tipo: 'madera', valor: 120 },
    bambu: { id: 'bambu', nombre: 'Tallo de Bambú 🎋', tipo: 'madera', valor: 200 },
    ebano: { id: 'ebano', nombre: 'Ébano Negro Ancestral 🪵✨', tipo: 'madera', valor: 850 },

    // Pesca
    basura: { id: 'basura', nombre: 'Bota Vieja / Basura 👞', tipo: 'pesca', valor: 5 },
    pez_comun: { id: 'pez_comun', nombre: 'Pez de Río 🐟', tipo: 'pesca', valor: 60 },
    camaron: { id: 'camaron', nombre: 'Camarón Fresco 🦐', tipo: 'pesca', valor: 180 },
    pulpo: { id: 'pulpo', nombre: 'Pulpo Gigante 🐙', tipo: 'pesca', valor: 500 },
    tiburon: { id: 'tiburon', nombre: 'Tiburón Blanco 🦈', tipo: 'pesca', valor: 1600 },
    ballena: { id: 'ballena', nombre: 'Ballena Legendaria 🐋👑', tipo: 'pesca', valor: 4500 },

    // Caza
    carne_conejo: { id: 'carne_conejo', nombre: 'Carne de Conejo 🐇', tipo: 'caza', valor: 70 },
    cuero: { id: 'cuero', nombre: 'Cuero Curtido 🥋', tipo: 'caza', valor: 140 },
    carne_ciervo: { id: 'carne_ciervo', nombre: 'Carne de Ciervo 🦌', tipo: 'caza', valor: 350 },
    piel_oso: { id: 'piel_oso', nombre: 'Piel de Oso Pardo 🐻', tipo: 'caza', valor: 900 },
    cuerno_mitico: { id: 'cuerno_mitico', nombre: 'Cuerno de Bestia Mítica 🦄✨', tipo: 'caza', valor: 3000 },

    // Semillas y Cultivos
    semilla_trigo: { id: 'semilla_trigo', nombre: 'Semillas de Trigo 🌾', tipo: 'semilla', tiempoMs: 3 * 60 * 1000, valor: 40, cosecha: 'trigo', cantCosecha: 3 },
    trigo: { id: 'trigo', nombre: 'Fardo de Trigo 🌾', tipo: 'cultivo', valor: 80 },
    semilla_tomate: { id: 'semilla_tomate', nombre: 'Semillas de Tomate 🍅', tipo: 'semilla', tiempoMs: 8 * 60 * 1000, valor: 80, cosecha: 'tomate', cantCosecha: 3 },
    tomate: { id: 'tomate', nombre: 'Tomate Jugoso 🍅', tipo: 'cultivo', valor: 160 },
    semilla_zanahoria: { id: 'semilla_zanahoria', nombre: 'Semillas de Zanahoria 🥕', tipo: 'semilla', tiempoMs: 15 * 60 * 1000, valor: 120, cosecha: 'zanahoria', cantCosecha: 4 },
    zanahoria: { id: 'zanahoria', nombre: 'Zanahoria Dorada 🥕', tipo: 'cultivo', valor: 250 },
    semilla_manzana_dorada: { id: 'semilla_manzana_dorada', nombre: 'Brote de Manzano Sagrado 🍏✨', tipo: 'semilla', tiempoMs: 30 * 60 * 1000, valor: 600, cosecha: 'manzana_dorada', cantCosecha: 2 },
    manzana_dorada: { id: 'manzana_dorada', nombre: 'Manzana Sagrada 🍏✨', tipo: 'cultivo', valor: 1500 },

    // Pociones (Alquimia)
    pocion_vida: { id: 'pocion_vida', nombre: 'Poción de Curación Mayor 🧪❤️', tipo: 'pocion', hp: 120, valor: 400 },
    pocion_mana: { id: 'pocion_mana', nombre: 'Elixir de Maná Radiante 🧪🔷', tipo: 'pocion', mana: 80, valor: 550 },
    pocion_suerte: { id: 'pocion_suerte', nombre: 'Poción de Fortuna y Suerte 🧪🍀', tipo: 'pocion', suerte: 2, valor: 800 },
    pocion_exp: { id: 'pocion_exp', nombre: 'Frasco de Esencia de EXP 🧪🔮', tipo: 'pocion', exp: 600, valor: 1200 },

    // Comida (Cocina)
    pan: { id: 'pan', nombre: 'Pan Casero Horneado 🍞', tipo: 'comida', energiaPet: 30, valor: 180 },
    sopa: { id: 'sopa', nombre: 'Sopa Reconfortante de Verduras 🍲', tipo: 'comida', energiaPet: 60, valor: 450 },
    banquete: { id: 'banquete', nombre: 'Banquete Real de Pescado y Caza 🍖🍱', tipo: 'comida', energiaPet: 100, valor: 1500 },

    // Equipo (Herrería / Armas / Armaduras)
    espada_hierro: { id: 'espada_hierro', nombre: 'Espada de Hierro Templado ⚔️', tipo: 'arma', bonusAtq: 35, valor: 1800 },
    espada_diamante: { id: 'espada_diamante', nombre: 'Espada de Diamante Divina 💎⚔️', tipo: 'arma', bonusAtq: 100, valor: 8500 },
    armadura_hierro: { id: 'armadura_hierro', nombre: 'Coraza de Malla de Hierro 🛡️', tipo: 'armadura', bonusDef: 30, valor: 1600 },
    armadura_diamante: { id: 'armadura_diamante', nombre: 'Armadura Completa de Diamante 💎🛡️', tipo: 'armadura', bonusDef: 90, valor: 8000 }
};

// Recetas de crafteo, cocina, alquimia y herrería
const RECETAS = {
    // Herrería
    espada_hierro: { id: 'espada_hierro', cat: 'blacksmith', name: 'Espada de Hierro ⚔️', req: { hierro: 5, madera_comun: 2 }, result: { item: 'espada_hierro', cant: 1, exp: 200 } },
    espada_diamante: { id: 'espada_diamante', cat: 'blacksmith', name: 'Espada de Diamante 💎⚔️', req: { diamante: 6, roble: 3, oro: 2 }, result: { item: 'espada_diamante', cant: 1, exp: 800 } },
    armadura_hierro: { id: 'armadura_hierro', cat: 'blacksmith', name: 'Armadura de Hierro 🛡️', req: { hierro: 8, cuero: 4 }, result: { item: 'armadura_hierro', cant: 1, exp: 220 } },
    armadura_diamante: { id: 'armadura_diamante', cat: 'blacksmith', name: 'Armadura de Diamante 💎🛡️', req: { diamante: 8, piel_oso: 2, oro: 3 }, result: { item: 'armadura_diamante', cant: 1, exp: 900 } },

    // Cocina
    pan: { id: 'pan', cat: 'cook', name: 'Pan Casero 🍞', req: { trigo: 3 }, result: { item: 'pan', cant: 1, exp: 80 } },
    sopa: { id: 'sopa', cat: 'cook', name: 'Sopa de Verduras 🍲', req: { tomate: 2, zanahoria: 2, carne_conejo: 1 }, result: { item: 'sopa', cant: 1, exp: 160 } },
    banquete: { id: 'banquete', cat: 'cook', name: 'Banquete Real 🍖🍱', req: { pez_comun: 2, carne_ciervo: 1, trigo: 2, tomate: 2 }, result: { item: 'banquete', cant: 1, exp: 400 } },

    // Alquimia
    pocion_vida: { id: 'pocion_vida', cat: 'alchemy', name: 'Poción de Curación Mayor 🧪❤️', req: { tomate: 3, roca: 2 }, result: { item: 'pocion_vida', cant: 1, exp: 120 } },
    pocion_mana: { id: 'pocion_mana', cat: 'alchemy', name: 'Elixir de Maná 🧪🔷', req: { pulpo: 1, bambu: 2 }, result: { item: 'pocion_mana', cant: 1, exp: 180 } },
    pocion_suerte: { id: 'pocion_suerte', cat: 'alchemy', name: 'Poción de Fortuna 🧪🍀', req: { camaron: 2, oro: 1, zanahoria: 2 }, result: { item: 'pocion_suerte', cant: 1, exp: 250 } },
    pocion_exp: { id: 'pocion_exp', cat: 'alchemy', name: 'Frasco de Esencia de EXP 🧪🔮', req: { manzana_dorada: 1, esmeralda: 1, cuerno_mitico: 1 }, result: { item: 'pocion_exp', cant: 1, exp: 600 } }
};

// Catálogo de mascotas
const PET_SPECIES = {
    gato: { id: 'gato', nombre: 'Gato Místico 🐱', precio: 3000, emoji: '🐱', tipo: 'comun', hab: '+5% Monedas en trabajos' },
    perro: { id: 'perro', nombre: 'Perro Guardián 🐶', precio: 3500, emoji: '🐶', tipo: 'comun', hab: '+10 Defensa en duelos' },
    zorro: { id: 'zorro', nombre: 'Zorro Astuto 🦊', precio: 6000, emoji: '🦊', tipo: 'raro', hab: '+15% Suerte en pesca y minería' },
    lobo: { id: 'lobo', nombre: 'Lobo Ártico 🐺', precio: 8000, emoji: '🐺', tipo: 'raro', hab: '+20 Ataque en duelos' },
    dragon: { id: 'dragon', nombre: 'Dragón Carmesí 🐉', precio: 25000, emoji: '🐉', tipo: 'legendario', hab: '+50 Ataque y +25% EXP global' },
    fenix: { id: 'fenix', nombre: 'Fénix Solar 🦅🔥', precio: 30000, emoji: '🦅🔥', tipo: 'mitico', hab: '+50 Defensa e Inmunidad a trampas' }
};

class RpgManager {
    constructor() {
        this.data = {
            users: {},       // jid -> { inventario: {}, garden: [], pet: null, cooldowns: {}, expedition: null }
            lottery: {}      // groupId -> { pot: 0, tickets: { userJid: count }, lastWinner: null }
        };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(RPG_DB_PATH)) {
                const raw = fs.readFileSync(RPG_DB_PATH, 'utf8');
                this.data = JSON.parse(raw);
                if (!this.data.users) this.data.users = {};
                if (!this.data.lottery) this.data.lottery = {};
            } else {
                this.save();
            }
        } catch (err) {
            logger.error('[RPG] Error leyendo rpg.json:', err.message);
        }
    }

    save() {
        try {
            const dir = path.dirname(RPG_DB_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(RPG_DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (err) {
            logger.error('[RPG] Error guardando rpg.json:', err.message);
        }
    }

    cleanJid(jid) {
        if (!jid) return '';
        return jid.replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net';
    }

    getUserData(jid) {
        const id = this.cleanJid(jid);
        if (!this.data.users[id]) {
            this.data.users[id] = {
                inventario: {
                    semilla_trigo: 3,
                    semilla_tomate: 1,
                    pocion_vida: 1
                },
                garden: [],
                pet: null,
                cooldowns: {},
                expedition: null,
                stats: {
                    pecesPescados: 0,
                    mineralesMinados: 0,
                    maderasCortadas: 0,
                    animalesCazados: 0,
                    cultivosCosechados: 0,
                    objetosCrafteados: 0
                }
            };
            this.save();
        }

        const u = this.data.users[id];
        if (!u.inventario) u.inventario = {};
        if (!Array.isArray(u.garden)) u.garden = [];
        if (!u.cooldowns) u.cooldowns = {};
        if (!u.stats) u.stats = {};

        return u;
    }

    // ── GESTIÓN DE INVENTARIO ──
    addItem(jid, itemKey, count = 1) {
        const u = this.getUserData(jid);
        const qty = Math.max(1, parseInt(count, 10) || 1);
        u.inventario[itemKey] = (u.inventario[itemKey] || 0) + qty;
        this.save();
        return u.inventario[itemKey];
    }

    removeItem(jid, itemKey, count = 1) {
        const u = this.getUserData(jid);
        const qty = Math.max(1, parseInt(count, 10) || 1);
        const current = u.inventario[itemKey] || 0;
        if (current < qty) return false;
        u.inventario[itemKey] = current - qty;
        if (u.inventario[itemKey] <= 0) {
            delete u.inventario[itemKey];
        }
        this.save();
        return true;
    }

    getItemCount(jid, itemKey) {
        const u = this.getUserData(jid);
        return u.inventario[itemKey] || 0;
    }

    getInventoryList(jid) {
        const u = this.getUserData(jid);
        const items = [];
        for (const [key, qty] of Object.entries(u.inventario)) {
            if (qty > 0) {
                const meta = RPG_ITEMS[key] || { nombre: key, tipo: 'objeto', valor: 10 };
                items.push({ id: key, ...meta, cantidad: qty });
            }
        }
        return items;
    }

    // ── COOLDOWNS ──
    checkCooldown(jid, action, cooldownMs) {
        const u = this.getUserData(jid);
        const now = Date.now();
        const last = u.cooldowns[action] || 0;
        if (now - last < cooldownMs) {
            const remMs = cooldownMs - (now - last);
            const mins = Math.floor(remMs / 60000);
            const secs = Math.floor((remMs % 60000) / 1000);
            return { ready: false, timeLeft: `${mins}m ${secs}s` };
        }
        u.cooldowns[action] = now;
        this.save();
        return { ready: true };
    }

    // ── RECOLECCIÓN: PESCA (.fishing) ──
    fish(jid) {
        const cd = this.checkCooldown(jid, 'fishing', 3 * 60 * 1000);
        if (!cd.ready) return { success: false, cd };

        const rand = Math.random() * 100;
        let itemKey = 'pez_comun';
        let monedas = 0;
        let exp = 0;

        if (rand < 25) {
            itemKey = 'basura';
            monedas = 20;
            exp = 15;
        } else if (rand < 65) {
            itemKey = 'pez_comun';
            monedas = 150;
            exp = 50;
        } else if (rand < 83) {
            itemKey = 'camaron';
            monedas = 350;
            exp = 90;
        } else if (rand < 94) {
            itemKey = 'pulpo';
            monedas = 850;
            exp = 180;
        } else if (rand < 99) {
            itemKey = 'tiburon';
            monedas = 2200;
            exp = 400;
        } else {
            itemKey = 'ballena';
            monedas = 6000;
            exp = 1000;
        }

        this.addItem(jid, itemKey, 1);
        economy.addCoins(jid, monedas);
        const expRes = economy.addExp(jid, exp);

        const u = this.getUserData(jid);
        u.stats.pecesPescados = (u.stats.pecesPescados || 0) + 1;
        this.save();

        return {
            success: true,
            item: RPG_ITEMS[itemKey],
            monedas,
            exp,
            leveledUp: expRes.leveledUp,
            newLevel: expRes.level
        };
    }

    // ── RECOLECCIÓN: MINERÍA (.mining) ──
    mine(jid) {
        const cd = this.checkCooldown(jid, 'mining', 3 * 60 * 1000);
        if (!cd.ready) return { success: false, cd };

        const rand = Math.random() * 100;
        let itemKey = 'roca';
        let count = 1;
        let monedas = 0;
        let exp = 0;

        if (rand < 45) {
            itemKey = 'roca';
            count = Math.floor(Math.random() * 3) + 2;
            monedas = 100;
            exp = 40;
        } else if (rand < 75) {
            itemKey = 'hierro';
            count = Math.floor(Math.random() * 2) + 1;
            monedas = 300;
            exp = 90;
        } else if (rand < 90) {
            itemKey = 'oro';
            count = 1;
            monedas = 700;
            exp = 180;
        } else if (rand < 98) {
            itemKey = 'diamante';
            count = 1;
            monedas = 2000;
            exp = 450;
        } else {
            itemKey = 'esmeralda';
            count = 1;
            monedas = 5000;
            exp = 950;
        }

        this.addItem(jid, itemKey, count);
        economy.addCoins(jid, monedas);
        const expRes = economy.addExp(jid, exp);

        const u = this.getUserData(jid);
        u.stats.mineralesMinados = (u.stats.mineralesMinados || 0) + count;
        this.save();

        return {
            success: true,
            item: RPG_ITEMS[itemKey],
            count,
            monedas,
            exp,
            leveledUp: expRes.leveledUp,
            newLevel: expRes.level
        };
    }

    // ── RECOLECCIÓN: TALA (.woodcut) ──
    woodcut(jid) {
        const cd = this.checkCooldown(jid, 'woodcut', 3 * 60 * 1000);
        if (!cd.ready) return { success: false, cd };

        const rand = Math.random() * 100;
        let itemKey = 'madera_comun';
        let count = 1;
        let monedas = 0;
        let exp = 0;

        if (rand < 50) {
            itemKey = 'madera_comun';
            count = Math.floor(Math.random() * 3) + 2;
            monedas = 120;
            exp = 45;
        } else if (rand < 80) {
            itemKey = 'roble';
            count = Math.floor(Math.random() * 2) + 1;
            monedas = 350;
            exp = 100;
        } else if (rand < 94) {
            itemKey = 'bambu';
            count = 2;
            monedas = 650;
            exp = 190;
        } else {
            itemKey = 'ebano';
            count = 1;
            monedas = 2500;
            exp = 550;
        }

        this.addItem(jid, itemKey, count);
        economy.addCoins(jid, monedas);
        const expRes = economy.addExp(jid, exp);

        const u = this.getUserData(jid);
        u.stats.maderasCortadas = (u.stats.maderasCortadas || 0) + count;
        this.save();

        return {
            success: true,
            item: RPG_ITEMS[itemKey],
            count,
            monedas,
            exp,
            leveledUp: expRes.leveledUp,
            newLevel: expRes.level
        };
    }

    // ── RECOLECCIÓN: CAZA (.hunting) ──
    hunt(jid) {
        const cd = this.checkCooldown(jid, 'hunting', 4 * 60 * 1000);
        if (!cd.ready) return { success: false, cd };

        const rand = Math.random() * 100;
        let itemKey = 'carne_conejo';
        let monedas = 0;
        let exp = 0;

        if (rand < 40) {
            itemKey = 'carne_conejo';
            monedas = 150;
            exp = 50;
        } else if (rand < 70) {
            itemKey = 'cuero';
            monedas = 300;
            exp = 95;
        } else if (rand < 88) {
            itemKey = 'carne_ciervo';
            monedas = 700;
            exp = 190;
        } else if (rand < 97) {
            itemKey = 'piel_oso';
            monedas = 1800;
            exp = 420;
        } else {
            itemKey = 'cuerno_mitico';
            monedas = 4500;
            exp = 900;
        }

        this.addItem(jid, itemKey, 1);
        economy.addCoins(jid, monedas);
        const expRes = economy.addExp(jid, exp);

        const u = this.getUserData(jid);
        u.stats.animalesCazados = (u.stats.animalesCazados || 0) + 1;
        this.save();

        return {
            success: true,
            item: RPG_ITEMS[itemKey],
            monedas,
            exp,
            leveledUp: expRes.leveledUp,
            newLevel: expRes.level
        };
    }

    // ── HUERTO / JARDÍN EN TIEMPO REAL (.garden) ──
    plantCrop(jid, seedKey) {
        const u = this.getUserData(jid);
        const seedMeta = RPG_ITEMS[seedKey];
        if (!seedMeta || seedMeta.tipo !== 'semilla') {
            return { error: 'INVALID_SEED' };
        }

        if ((u.inventario[seedKey] || 0) < 1) {
            return { error: 'NO_SEEDS' };
        }

        if (u.garden.length >= 4) {
            return { error: 'GARDEN_FULL' };
        }

        this.removeItem(jid, seedKey, 1);
        const now = Date.now();
        const plot = {
            id: 'plot_' + now,
            seedKey,
            plantedAt: now,
            harvestAt: now + seedMeta.tiempoMs
        };

        u.garden.push(plot);
        this.save();

        return { success: true, plot, seedMeta };
    }

    harvestGarden(jid) {
        const u = this.getUserData(jid);
        if (u.garden.length === 0) {
            return { error: 'EMPTY_GARDEN' };
        }

        const now = Date.now();
        const harvested = [];
        const remaining = [];

        for (const plot of u.garden) {
            const seedMeta = RPG_ITEMS[plot.seedKey];
            if (now >= plot.harvestAt) {
                const harvestKey = seedMeta.cosecha;
                const cant = seedMeta.cantCosecha || 2;
                this.addItem(jid, harvestKey, cant);
                harvested.push({
                    crop: RPG_ITEMS[harvestKey],
                    count: cant
                });
                u.stats.cultivosCosechados = (u.stats.cultivosCosechados || 0) + cant;
            } else {
                remaining.push(plot);
            }
        }

        u.garden = remaining;
        this.save();

        if (harvested.length === 0) {
            return { error: 'NOT_READY_YET' };
        }

        // Otorgar EXP y monedas por cosecha
        const expEarned = harvested.length * 120;
        const coinsEarned = harvested.length * 250;
        economy.addCoins(jid, coinsEarned);
        const expRes = economy.addExp(jid, expEarned);

        return {
            success: true,
            harvested,
            coinsEarned,
            expEarned,
            leveledUp: expRes.leveledUp,
            newLevel: expRes.level
        };
    }

    getGardenStatus(jid) {
        const u = this.getUserData(jid);
        const now = Date.now();
        return u.garden.map((p, idx) => {
            const seed = RPG_ITEMS[p.seedKey];
            const ready = now >= p.harvestAt;
            const remSecs = Math.max(0, Math.ceil((p.harvestAt - now) / 1000));
            return {
                idx: idx + 1,
                name: seed.nombre,
                ready,
                timeLeft: ready ? 'Listo para cosechar 🌱✨' : `${Math.floor(remSecs / 60)}m ${remSecs % 60}s`
            };
        });
    }

    // ── ARTESANÍA Y CRAFTEO (.craft, .cook, .alchemy, .blacksmith) ──
    craftItem(jid, recipeId) {
        const id = (recipeId || '').toLowerCase().trim();
        const recipe = RECETAS[id];
        if (!recipe) return { error: 'RECIPE_NOT_FOUND' };

        const u = this.getUserData(jid);

        // Verificar materiales
        for (const [mat, reqQty] of Object.entries(recipe.req)) {
            const hasQty = u.inventario[mat] || 0;
            if (hasQty < reqQty) {
                const matInfo = RPG_ITEMS[mat] || { nombre: mat };
                return { error: 'MISSING_MATERIALS', missing: matInfo.nombre, needed: reqQty, has: hasQty };
            }
        }

        // Consumir materiales
        for (const [mat, reqQty] of Object.entries(recipe.req)) {
            this.removeItem(jid, mat, reqQty);
        }

        // Entregar resultado
        this.addItem(jid, recipe.result.item, recipe.result.cant);
        const expRes = economy.addExp(jid, recipe.result.exp);

        // Si es forja, otorgar bonificaciones permanentes al jugador
        const craftedMeta = RPG_ITEMS[recipe.result.item];
        if (craftedMeta.bonusAtq) {
            const ecoUser = economy.getUser(jid);
            ecoUser.ataque = (ecoUser.ataque || 15) + craftedMeta.bonusAtq;
            economy.save();
        }
        if (craftedMeta.bonusDef) {
            const ecoUser = economy.getUser(jid);
            ecoUser.defensa = (ecoUser.defensa || 10) + craftedMeta.bonusDef;
            economy.save();
        }

        u.stats.objetosCrafteados = (u.stats.objetosCrafteados || 0) + 1;
        this.save();

        return {
            success: true,
            recipe,
            crafted: craftedMeta,
            cant: recipe.result.cant,
            exp: recipe.result.exp,
            leveledUp: expRes.leveledUp,
            newLevel: expRes.level
        };
    }

    // ── MASCOTAS (.pet, .petshop, .breeding) ──
    buyPet(jid, speciesId, petName) {
        const species = PET_SPECIES[speciesId];
        if (!species) return { error: 'SPECIES_NOT_FOUND' };

        const u = this.getUserData(jid);
        if (u.pet) return { error: 'ALREADY_HAVE_PET' };

        const ecoUser = economy.getUser(jid);
        if ((ecoUser.monedas || 0) < species.precio) {
            return { error: 'NO_MONEY', needed: species.precio, has: ecoUser.monedas || 0 };
        }

        economy.removeCoins(jid, species.precio);

        u.pet = {
            id: species.id,
            species: species.nombre,
            emoji: species.emoji,
            name: petName || species.nombre,
            level: 1,
            exp: 0,
            hambre: 100,      // 0 - 100
            energia: 100,     // 0 - 100
            felicidad: 100,   // 0 - 100
            lastFed: Date.now(),
            lastTrained: 0,
            bornAt: Date.now()
        };
        this.save();

        return { success: true, pet: u.pet };
    }

    feedPet(jid) {
        const u = this.getUserData(jid);
        if (!u.pet) return { error: 'NO_PET' };

        // Intentar usar comida del inventario, o costar $150
        let fedWith = 'alimento básico';
        if (this.removeItem(jid, 'pan', 1)) {
            fedWith = 'Pan horneado 🍞';
        } else if (this.removeItem(jid, 'sopa', 1)) {
            fedWith = 'Sopa nutritiva 🍲';
        } else {
            const ecoUser = economy.getUser(jid);
            if ((ecoUser.monedas || 0) < 150) {
                return { error: 'NO_FOOD_NO_COINS' };
            }
            economy.removeCoins(jid, 150);
        }

        u.pet.hambre = 100;
        u.pet.felicidad = Math.min(100, u.pet.felicidad + 20);
        u.pet.lastFed = Date.now();
        this.save();

        return { success: true, pet: u.pet, fedWith };
    }

    trainPet(jid) {
        const u = this.getUserData(jid);
        if (!u.pet) return { error: 'NO_PET' };

        const cd = this.checkCooldown(jid, 'pet_train', 10 * 60 * 1000);
        if (!cd.ready) return { error: 'PET_TIRED', timeLeft: cd.timeLeft };

        if (u.pet.energia < 20) {
            return { error: 'LOW_ENERGY' };
        }

        u.pet.energia -= 20;
        u.pet.exp += 150;
        let leveledUp = false;

        if (u.pet.exp >= u.pet.level * 300) {
            u.pet.exp -= u.pet.level * 300;
            u.pet.level += 1;
            u.pet.felicidad = 100;
            leveledUp = true;
        }

        // Bonificación de EXP al dueño
        const ownerExpRes = economy.addExp(jid, 100);
        this.save();

        return {
            success: true,
            pet: u.pet,
            leveledUp,
            ownerLeveledUp: ownerExpRes.leveledUp,
            ownerLevel: ownerExpRes.level
        };
    }

    breedPets(jid1, jid2) {
        const u1 = this.getUserData(jid1);
        const u2 = this.getUserData(jid2);

        if (!u1.pet || !u2.pet) return { error: 'BOTH_NEED_PETS' };
        if (u1.pet.level < 3 || u2.pet.level < 3) return { error: 'LEVEL_TOO_LOW' };

        const cd1 = this.checkCooldown(jid1, 'breeding', 12 * 60 * 60 * 1000);
        if (!cd1.ready) return { error: 'BREEDING_CD', timeLeft: cd1.timeLeft };

        // Determinar cría híbrida o heredada
        const speciesKeys = Object.keys(PET_SPECIES);
        const randomSpeciesKey = speciesKeys[Math.floor(Math.random() * speciesKeys.length)];
        const babySpecies = PET_SPECIES[randomSpeciesKey];

        // Otorgar EXP y recompensa de crianza
        economy.addExp(jid1, 350);
        economy.addExp(jid2, 350);
        economy.addCoins(jid1, 1500);
        economy.addCoins(jid2, 1500);

        return {
            success: true,
            parent1: u1.pet,
            parent2: u2.pet,
            baby: babySpecies
        };
    }

    // ── EXPEDICIONES PASIVAS (.expedition) ──
    startExpedition(jid, zoneIndex = 1) {
        const u = this.getUserData(jid);
        if (u.expedition) {
            const now = Date.now();
            if (now < u.expedition.finishAt) {
                const remSecs = Math.ceil((u.expedition.finishAt - now) / 1000);
                const hrs = Math.floor(remSecs / 3600);
                const mins = Math.floor((remSecs % 3600) / 60);
                return { error: 'ON_EXPEDITION', timeLeft: `${hrs}h ${mins}m` };
            } else {
                return { error: 'PENDING_CLAIM' };
            }
        }

        const ZONAS = [
            { id: 1, name: 'Bosque de las Nieblas 🌲🌫️', duracionMs: 1 * 60 * 60 * 1000, minCoins: 800, maxCoins: 2000, exp: 250 },
            { id: 2, name: 'Ruinas Sumergidas de Atlantis 🏛️🌊', duracionMs: 3 * 60 * 60 * 1000, minCoins: 2500, maxCoins: 6000, exp: 700 },
            { id: 3, name: 'Cráter del Volcán Eterno 🌋🔥', duracionMs: 6 * 60 * 60 * 1000, minCoins: 6000, maxCoins: 15000, exp: 1800 }
        ];

        const idx = Math.max(1, Math.min(3, parseInt(zoneIndex, 10) || 1));
        const zona = ZONAS[idx - 1];

        const now = Date.now();
        u.expedition = {
            zona: zona.name,
            duracionMs: zona.duracionMs,
            minCoins: zona.minCoins,
            maxCoins: zona.maxCoins,
            exp: zona.exp,
            startedAt: now,
            finishAt: now + zona.duracionMs
        };
        this.save();

        return { success: true, expedition: u.expedition };
    }

    claimExpedition(jid) {
        const u = this.getUserData(jid);
        if (!u.expedition) return { error: 'NO_EXPEDITION' };

        const now = Date.now();
        if (now < u.expedition.finishAt) {
            const remSecs = Math.ceil((u.expedition.finishAt - now) / 1000);
            const hrs = Math.floor(remSecs / 3600);
            const mins = Math.floor((remSecs % 3600) / 60);
            return { error: 'NOT_FINISHED', timeLeft: `${hrs}h ${mins}m` };
        }

        const expObj = u.expedition;
        const coinsEarned = Math.floor(Math.random() * (expObj.maxCoins - expObj.minCoins + 1)) + expObj.minCoins;
        const expEarned = expObj.exp;

        // Botín aleatorio de materiales raros
        const possibleLoot = ['diamante', 'oro', 'esmeralda', 'ebano', 'cuerno_mitico', 'semilla_manzana_dorada'];
        const lootItemKey = possibleLoot[Math.floor(Math.random() * possibleLoot.length)];
        const lootCount = Math.floor(Math.random() * 2) + 1;

        this.addItem(jid, lootItemKey, lootCount);
        economy.addCoins(jid, coinsEarned);
        const expRes = economy.addExp(jid, expEarned);

        u.expedition = null;
        this.save();

        return {
            success: true,
            zona: expObj.zona,
            coins: coinsEarned,
            exp: expEarned,
            lootItem: RPG_ITEMS[lootItemKey],
            lootCount,
            leveledUp: expRes.leveledUp,
            newLevel: expRes.level
        };
    }

    // ── LOTERÍA GRUPAL (.lottery) ──
    getLottery(groupId) {
        const id = this.cleanJid(groupId);
        if (!this.data.lottery[id]) {
            this.data.lottery[id] = {
                pozo: 5000,       // Pozo inicial de la casa
                ticketPrice: 500,
                tickets: {},      // userJid -> count
                lastWinner: null
            };
            this.save();
        }
        return this.data.lottery[id];
    }

    buyLotteryTicket(groupId, userJid, count = 1) {
        const lot = this.getLottery(groupId);
        const qty = Math.max(1, parseInt(count, 10) || 1);
        const totalCost = qty * lot.ticketPrice;

        const ecoUser = economy.getUser(userJid);
        if ((ecoUser.monedas || 0) < totalCost) {
            return { error: 'NO_MONEY', needed: totalCost, has: ecoUser.monedas || 0 };
        }

        economy.removeCoins(userJid, totalCost);
        lot.pozo += totalCost;
        lot.tickets[userJid] = (lot.tickets[userJid] || 0) + qty;
        this.save();

        return {
            success: true,
            ticketsBought: qty,
            totalUserTickets: lot.tickets[userJid],
            pozo: lot.pozo
        };
    }

    drawLottery(groupId) {
        const lot = this.getLottery(groupId);
        const participants = Object.keys(lot.tickets);
        if (participants.length === 0) {
            return { error: 'NO_PARTICIPANTS' };
        }

        // Construir urna ponderada según la cantidad de boletos comprados
        const urn = [];
        for (const [userJid, count] of Object.entries(lot.tickets)) {
            for (let i = 0; i < count; i++) {
                urn.push(userJid);
            }
        }

        const winnerJid = urn[Math.floor(Math.random() * urn.length)];
        const totalPot = lot.pozo;

        // Entregar premio y EXP al afortunado ganador
        economy.addCoins(winnerJid, totalPot);
        const expRes = economy.addExp(winnerJid, 300);

        lot.lastWinner = {
            jid: winnerJid,
            prize: totalPot,
            drawnAt: Date.now()
        };
        lot.pozo = 5000;
        lot.tickets = {};
        this.save();

        return {
            success: true,
            winnerJid,
            prize: totalPot,
            totalTickets: urn.length,
            leveledUp: expRes.leveledUp,
            newLevel: expRes.level
        };
    }
}

const rpgManager = new RpgManager();
module.exports = rpgManager;
module.exports.RPG_ITEMS = RPG_ITEMS;
module.exports.RECETAS = RECETAS;
module.exports.PET_SPECIES = PET_SPECIES;

