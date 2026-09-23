// --- 1. CONNEXION SUPABASE ---
const SUPABASE_URL = 'https://bansqfbzsdjovlaewrvx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-r-98cutZLtigCMEhfILOQ_uXX1byh0';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. LISTE DE TOUS LES EXERCICES (MISE À JOUR COMPLÈTE PILOTEST) ---
const tousLesExercices = [
    "Airways", 
    "Angles à cocher", 
    "Angles à saisir", 
    "Attention 1", 
    "Attention 2", 
    "Attention 3", 
    "Billes", 
    "Boîtes à mots", 
    "Calcul mental 1", 
    "Calcul mental 2", 
    "Calcul mental 3", 
    "Calcul mental 4", 
    "Cubes 2D/3D - psy0 Air France", 
    "DLR/AF Cadets psy1 - VLR - Orientation spatiale", 
    "Dominos", 
    "EFG", 
    "Empilements", 
    "Formes et couleurs", 
    "Formes glissées - I", 
    "Formes glissées - II", 
    "Grilles de calculs", 
    "Lecture de textes", 
    "M2 Back numérique", 
    "Mathématiques", 
    "Matrices de Raven", 
    "Memory 2 Back couleurs", 
    "Memory 3 Back", 
    "Memory 4 Back", 
    "Memory 5 Back", 
    "Mémoire de travail I", 
    "Mémoire de travail II", 
    "Mots en étoile", 
    "Objets 3D", 
    "Pair ou impair", 
    "Patrons de cubes - psy1 - Cadets AF", 
    "Psychomoteur ENAC", 
    "Psychomoteur psy0 AF cadet", 
    "Séries logiques", 
    "Tangram", 
    "Tangram à compléter", 
    "Test des compteurs", 
    "Trouvez l'intrus @Air France", 
    "Un mot sur deux", 
    "Voitures (basique)", 
    "Voitures (séquentiel)"
];

let statsGlobales = {};
let groupesPersonnalisés = {}; 
let groupeActif = "Tous";
let evolutionChart = null;
let barChart = null;
let radarChart = null;
let exerciceActuelDrawer = null;

// NOUVEAU : Tableau qui va stocker toutes les astuces venues de Supabase
let astucesGlobales = [];

// --- 3. CHARGEMENT DEPUIS LE CLOUD ---
async function chargerDonnees() {
    tousLesExercices.forEach(ex => statsGlobales[ex] = { scores: [], dates: [], ids: [] });

    // 1. Charger les scores
    const { data: scoresData, error: scoresError } = await supabaseClient.from('scores').select('*').order('id', { ascending: true });
    if (!scoresError && scoresData) {
        scoresData.forEach(row => {
            if (statsGlobales[row.exercice]) {
                statsGlobales[row.exercice].scores.push(row.score_stanine);
                statsGlobales[row.exercice].dates.push(row.date_test);
                statsGlobales[row.exercice].ids.push(row.id);
            }
        });
    }

    // 2. Charger les groupes
    const { data: groupesData, error: groupesError } = await supabaseClient.from('groupes').select('*');
    groupesPersonnalisés = {};
    if (!groupesError && groupesData) {
        groupesData.forEach(g => {
            if (Array.isArray(g.exercices)) {
                groupesPersonnalisés[g.nom] = { exercices: g.exercices, sousCategories: {} };
            } else {
                groupesPersonnalisés[g.nom] = g.exercices;
            }
        });
    }

    // 3. Charger les astuces (NOUVEAU)
    const { data: astucesData, error: astucesError } = await supabaseClient.from('astuces').select('*').order('id', { ascending: false });
    if (!astucesError && astucesData) {
        astucesGlobales = astucesData;
    }
}

// --- 4. SAUVEGARDE DES SCORES ---
async function enregistrerScore(scoreStanine) {
    const exerciceSelectionne = document.getElementById('select-exercice').value;
    if (!exerciceSelectionne) return;

    const dateJour = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });

    statsGlobales[exerciceSelectionne].scores.push(scoreStanine);
    statsGlobales[exerciceSelectionne].dates.push(dateJour);
    
    await supabaseClient.from('scores').insert([
        { date_test: dateJour, exercice: exerciceSelectionne, score_stanine: scoreStanine }
    ]);

    const message = document.getElementById('message-confirmation');
    message.classList.remove('hidden');
    setTimeout(() => message.classList.add('hidden'), 3000);

    genererBandeauxEtGraphiquesGlobaux();
}

async function sauvegarderGroupesDansCloud() {
    const formattedGroups = Object.keys(groupesPersonnalisés).map(nom => ({
        nom: nom,
        exercices: groupesPersonnalisés[nom]
    }));
    if (formattedGroups.length > 0) {
        await supabaseClient.from('groupes').upsert(formattedGroups);
    }
}

async function supprimerGroupeDansCloud(nomGroupe) {
    await supabaseClient.from('groupes').delete().eq('nom', nomGroupe);
}

// Palette de couleurs
const getColorForClass = (num) => {
    const colors = {
        1: '#E30613',
        2: '#E84E0F',
        3: '#F18700',
        4: '#FBBA00',
        5: '#FFE600E8',
        6: '#9ED800',
        7: '#02B74B',
        8: '#009ED4',
        9: '#003366'
    };
    const rounded = Math.min(9, Math.max(1, Math.round(num)));
    return colors[rounded] || '#003366';
};

const getTextColorForClass = (num) => {
    const rounded = Math.min(9, Math.max(1, Math.round(num)));
    return rounded === 9 ? '#ffffff' : '#0f172a';
};

// --- 5. INTERFACE & NAVIGATION ---
function afficherNavigationGroupes() {
    const navContainer = document.getElementById('groupes-nav');
    if (!navContainer) return;
    navContainer.innerHTML = '';

    const btnTous = document.createElement('button');
    btnTous.textContent = "Tous";
    btnTous.className = `px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${groupeActif === 'Tous' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;
    btnTous.onclick = () => changerGroupe('Tous');
    navContainer.appendChild(btnTous);

    Object.keys(groupesPersonnalisés).forEach(nomGroupe => {
        const btn = document.createElement('button');
        btn.textContent = nomGroupe;
        btn.className = `px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${groupeActif === nomGroupe ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;
        btn.onclick = () => changerGroupe(nomGroupe);
        navContainer.appendChild(btn);
    });

    const labelActif = document.getElementById('label-groupe-actif');
    if(labelActif) labelActif.textContent = `Groupe : ${groupeActif}`;
    
    const titreDroite = document.getElementById('titre-groupe-droite');
    if(titreDroite) titreDroite.textContent = groupeActif === 'Tous' ? 'Tous' : groupeActif;

    const bandeauCat = document.getElementById('bandeau-gestion-categories');
    const fallbackTous = document.getElementById('fallback-liste-tous');

    if (bandeauCat && fallbackTous) {
        if (groupeActif === 'Tous') {
            bandeauCat.classList.add('hidden');
            fallbackTous.classList.remove('hidden');
        } else {
            bandeauCat.classList.remove('hidden');
            fallbackTous.classList.add('hidden');
            renderCategoriesDirectementDansBandeau();
        }
    }
}

function changerGroupe(nomGroupe) {
    groupeActif = nomGroupe;
    afficherNavigationGroupes();
    initialiserFormulaireSelect();
    genererBandeauxEtGraphiquesGlobaux();
}

function initFormulaire() {
    const zoneBoutons = document.getElementById('zone-boutons-stanine');
    if(!zoneBoutons) return;
    zoneBoutons.innerHTML = '<span class="text-xs text-slate-500 font-medium mr-1 flex items-center">Score :</span>';
    
    for (let i = 1; i <= 9; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = "w-8 h-8 rounded font-bold text-xs transition-transform hover:scale-110 active:scale-95 shadow-sm";
        btn.style.backgroundColor = getColorForClass(i);
        btn.style.color = getTextColorForClass(i);
        btn.onclick = () => enregistrerScore(i);
        zoneBoutons.appendChild(btn);
    }

    const select = document.getElementById('select-exercice');
    select.addEventListener('change', (e) => {
        if (e.target.value !== "") {
            zoneBoutons.classList.remove('opacity-30', 'pointer-events-none');
        } else {
            zoneBoutons.classList.add('opacity-30', 'pointer-events-none');
        }
    });

    initialiserFormulaireSelect();
}

function initialiserFormulaireSelect() {
    const select = document.getElementById('select-exercice');
    if(!select) return;
    select.innerHTML = '<option value="">-- Sélectionner un test --</option>';

    let exercicesDisponibles = tousLesExercices;
    if (groupeActif !== "Tous" && groupesPersonnalisés[groupeActif]) {
        let g = groupesPersonnalisés[groupeActif];
        if (Array.isArray(g)) g = { exercices: g, sousCategories: {} };
        exercicesDisponibles = g.exercices || [];
    }

    exercicesDisponibles.forEach(ex => {
        const option = document.createElement('option');
        option.value = ex;
        option.textContent = ex;
        select.appendChild(option);
    });

    const zoneBoutons = document.getElementById('zone-boutons-stanine');
    if(zoneBoutons) zoneBoutons.classList.add('opacity-30', 'pointer-events-none');
}

function genererBandeauxEtGraphiquesGlobaux() {
    genererBandeauxGauche();
    genererSyntheseDroite();
}

function genererBandeauxGauche() {
    if (groupeActif === 'Tous') {
        const container = document.getElementById('exercices-list');
        if (!container) return;
        container.innerHTML = '';
        tousLesExercices.forEach(ex => {
            container.innerHTML += rendreLigneExerciceCompacte(ex);
        });
    } else {
        renderCategoriesDirectementDansBandeau();
    }
}

function renderCategoriesDirectementDansBandeau() {
    const container = document.getElementById('conteneur-categories-avec-exercices');
    if (!container) return;
    container.innerHTML = '';

    if (groupeActif === 'Tous' || !groupesPersonnalisés[groupeActif]) return;
    let g = groupesPersonnalisés[groupeActif];
    if (Array.isArray(g)) g = { exercices: g, sousCategories: {} };
    
    const sousCats = g.sousCategories || {};
    const exercicesDuGroupe = g.exercices || [];
    const nomsCats = Object.keys(sousCats);

    if (nomsCats.length === 0 && exercicesDuGroupe.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">Aucun exercice dans ce groupe.<br>Cliquez sur <strong>"Gérer les Groupes"</strong> en haut pour en ajouter.</div>`;
        return;
    }

    nomsCats.forEach(nomCat => {
        const exList = (sousCats[nomCat] || []).filter(ex => exercicesDuGroupe.includes(ex));
        let htmlExercicesDansCat = '';
        if (exList.length === 0) {
            htmlExercicesDansCat = `<div class="p-3 text-[11px] text-slate-400 italic text-center">Aucun exercice dans cette catégorie.</div>`;
        } else {
            exList.forEach(ex => { htmlExercicesDansCat += rendreLigneExerciceCompacte(ex); });
        }

        container.innerHTML += `
            <div class="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div class="bg-slate-100 px-4 py-2.5 flex justify-between items-center border-b border-slate-200">
                    <span class="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">📁 ${nomCat} <span class="text-[10px] text-slate-400 font-normal">(${exList.length} test(s))</span></span>
                    <button onclick="editerCategorie('${nomCat}')" class="text-slate-400 hover:text-indigo-600 p-1 text-xs font-bold" title="Modifier cette catégorie">⚙️</button>
                </div>
                <div class="divide-y divide-slate-100 bg-white">${htmlExercicesDansCat}</div>
            </div>
        `;
    });

    const tousExClasses = [];
    Object.values(sousCats).forEach(liste => tousExClasses.push(...liste));
    const exercicesNonClasses = exercicesDuGroupe.filter(ex => !tousExClasses.includes(ex));

    if (exercicesNonClasses.length > 0 || nomsCats.length === 0) {
        let htmlAutresExercices = '';
        exercicesNonClasses.forEach(ex => { htmlAutresExercices += rendreLigneExerciceCompacte(ex); });
        container.innerHTML += `
            <div class="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-2xs mt-4">
                <div class="bg-slate-100 px-4 py-2.5 flex justify-between items-center border-b border-slate-200">
                    <span class="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">📌 Autres tests <span class="text-[10px] text-slate-400 font-normal">(${exercicesNonClasses.length} test(s))</span></span>
                </div>
                <div class="divide-y divide-slate-100 bg-white">${htmlAutresExercices || '<div class="p-3 text-[11px] text-slate-400 italic text-center">Tous les tests du groupe sont classés dans des catégories !</div>'}</div>
            </div>
        `;
    }
}

function rendreLigneExerciceCompacte(ex) {
    const donnees = statsGlobales[ex] || { scores: [], dates: [], ids: [] };
    const nbEssais = donnees.scores.length;
    let moyenne = '-';
    let dernier = '-';

    if (nbEssais > 0) {
        const derniers15Scores = donnees.scores.slice(-15);
        const somme = derniers15Scores.reduce((a, b) => a + b, 0);
        moyenne = Math.round(somme / derniers15Scores.length);
        dernier = donnees.scores[nbEssais - 1];
    }

    const bgMoyenne = moyenne !== '-' ? getColorForClass(moyenne) : '#f1f5f9';
    const textMoyenne = moyenne !== '-' ? getTextColorForClass(moyenne) : '#94a3b8';
    const textDernier = dernier !== '-' ? getColorForClass(dernier) : '#94a3b8';

    const scoresRecents = donnees.scores.slice(-20);
    let html20Derniers = '';
    
    if (scoresRecents.length === 0) {
        html20Derniers = `<span class="text-[10px] text-slate-400 italic">Aucun essai</span>`;
    } else {
        scoresRecents.forEach(score => {
            const couleur = getColorForClass(score);
            const couleurTexte = getTextColorForClass(score);
            html20Derniers += `<div class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shadow-2xs" style="background-color: ${couleur}; color: ${couleurTexte};">${score}</div>`;
        });
    }

    return `
        <div onclick="ouvrirDrawer('${ex}')" class="grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-50 transition-colors cursor-pointer text-xs">
            <div class="col-span-4 flex items-center gap-2">
                <div>
                    <div class="font-semibold text-slate-800 text-xs">${ex}</div>
                    <div class="text-[10px] text-slate-400">${nbEssais} essai(s)</div>
                </div>
            </div>
            <div class="col-span-6 flex items-center justify-center gap-1 flex-wrap max-h-16 overflow-hidden px-2">
                ${html20Derniers}
            </div>
            <div class="col-span-1 flex justify-center">
                <div class="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shadow-sm" style="background-color: ${bgMoyenne}; color: ${textMoyenne};">${moyenne}</div>
            </div>
            <div class="col-span-1 flex justify-center">
                <div class="w-6 h-6 flex items-center justify-center font-bold text-sm" style="color: ${textDernier};">${dernier}</div>
            </div>
        </div>
    `;
}

function genererSyntheseDroite() {
    const containerBarres = document.getElementById('synthese-barres-categories');
    if (!containerBarres) return;
    containerBarres.innerHTML = '';

    let nomsCats = [];
    let sousCatsMap = {};

    if (groupeActif === "Tous") {
        nomsCats = ["Tous les tests"];
        sousCatsMap = { "Tous les tests": tousLesExercices };
    } else {
        let g = groupesPersonnalisés[groupeActif];
        if (Array.isArray(g)) g = { exercices: g, sousCategories: {} };
        sousCatsMap = g.sousCategories || {};
        nomsCats = Object.keys(sousCatsMap);
    }

    let moyennesParCat = {};
    let sommeTotaleMoyennes = 0;
    let nbCatsValides = 0;

    nomsCats.forEach(nomCat => {
        const exList = sousCatsMap[nomCat] || [];
        let sommeMoyennesEx = 0;
        let nbExAvecScores = 0;

        exList.forEach(ex => {
            const donnees = statsGlobales[ex];
            if (donnees && donnees.scores.length > 0) {
                const derniers15Scores = donnees.scores.slice(-15);
                const moyenneEx = derniers15Scores.reduce((a, b) => a + b, 0) / derniers15Scores.length;
                sommeMoyennesEx += moyenneEx;
                nbExAvecScores++;
            }
        });

        if (nbExAvecScores > 0) {
            const moyenneCat = sommeMoyennesEx / nbExAvecScores;
            moyennesParCat[nomCat] = moyenneCat;
            sommeTotaleMoyennes += moyenneCat;
            nbCatsValides++;
        } else {
            moyennesParCat[nomCat] = null;
        }
    });

    const moyenneGenerale = nbCatsValides > 0 ? (sommeTotaleMoyennes / nbCatsValides) : null;

    containerBarres.innerHTML += `
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div class="flex justify-between items-center mb-1.5 text-xs font-bold text-slate-700">
                <span>Moyenne</span>
                <span class="text-sm font-extrabold text-slate-700">${moyenneGenerale !== null ? moyenneGenerale.toFixed(1) : '—'}</span>
            </div>
            ${genererHtmlBarreProgression(moyenneGenerale)}
        </div>
        <div class="border-t my-3"></div>
    `;

    if (nomsCats.length === 0) {
        containerBarres.innerHTML += `<p class="text-xs text-slate-400 text-center py-4">Aucune catégorie définie pour ce groupe.</p>`;
    } else {
        nomsCats.forEach(nomCat => {
            const moyCat = moyennesParCat[nomCat];
            containerBarres.innerHTML += `
                <div class="py-1">
                    <div class="flex justify-between items-center mb-1 text-xs">
                        <span class="font-medium text-slate-600 truncate max-w-[75%]" title="${nomCat}">📁 ${nomCat}</span>
                        <span class="font-bold text-xs text-slate-600">${moyCat !== null ? moyCat.toFixed(1) : '—'}</span>
                    </div>
                    ${genererHtmlBarreProgression(moyCat)}
                </div>
            `;
        });
    }

    mettreAJourRadarChart(nomsCats, moyennesParCat);
}

function genererHtmlBarreProgression(valeurMoyenne) {
    if (valeurMoyenne === null || isNaN(valeurMoyenne)) {
        return `<div class="h-4 w-full bg-slate-100 rounded-full relative overflow-hidden flex items-center"><div class="w-full h-full flex justify-between px-1 absolute inset-0 pointer-events-none">${Array(8).fill('<div class="w-[1px] h-full bg-white/60"></div>').join('')}</div></div>`;
    }
    const pourcentage = Math.min(100, Math.max(0, (valeurMoyenne / 9) * 100));
    const classeInferieure = Math.floor(valeurMoyenne) || 1;
    const couleur = getColorForClass(classeInferieure);
    return `<div class="h-4 w-full bg-slate-100 rounded-full relative overflow-hidden flex items-center shadow-inner"><div class="h-full rounded-full transition-all duration-500 absolute left-0 top-0" style="width: ${pourcentage}%; background-color: ${couleur};"></div><div class="w-full h-full flex justify-between px-1 absolute inset-0 pointer-events-none">${Array(8).fill('<div class="w-[1px] h-full bg-white/70"></div>').join('')}</div></div>`;
}

function mettreAJourRadarChart(labels, moyennesMap) {
    const ctx = document.getElementById('radarChart').getContext('2d');
    if (radarChart != null) radarChart.destroy();
    const dataScores = labels.map(label => moyennesMap[label] !== null ? Number(moyennesMap[label].toFixed(1)) : 0);
    const pointColors = dataScores.map(score => score > 0 ? getColorForClass(score) : '#cbd5e1');

    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Moyenne Stanine',
                data: dataScores,
                backgroundColor: 'rgba(2, 183, 75, 0.12)',
                borderColor: '#02B74B',
                borderWidth: 2,
                pointBackgroundColor: pointColors,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { r: { min: 0, max: 9, ticks: { stepSize: 3, font: { size: 9 }, display: false }, grid: { color: '#e2e8f0' }, angleLines: { color: '#e2e8f0' }, pointLabels: { font: { size: 10, weight: 'bold' }, color: '#475569' } } },
            plugins: { legend: { display: false } }
        }
    });
}

// (Le reste des modales Groupes, Catégories, Tiroir et Supression reste identique. Je raccourcis le code générique pour gagner de la place, mais garde tes fonctions existantes intactes).
// [Copier ici tout ton bloc "// --- MODALES DE GESTION DES CATÉGORIES ET GROUPES ---" et "// --- GESTION DU TIROIR & SCORES ---" existant]
// Assure-toi de bien conserver ces blocs dans ton app.js !

// ==========================================
// --- 7. GESTION DE LA VUE AIDES & ASTUCES ---
// ==========================================

// Fonction pour basculer entre les onglets
window.changerOnglet = function(ongletCible) {
    const vueSuivi = document.getElementById('vue-suivi');
    const vueAstuces = document.getElementById('vue-astuces');
    const btnSuivi = document.getElementById('onglet-suivi');
    const btnAstuces = document.getElementById('onglet-astuces');

    if (ongletCible === 'suivi') {
        vueSuivi.classList.replace('hidden', 'block');
        vueAstuces.classList.replace('block', 'hidden');
        
        btnSuivi.className = "text-blue-600 border-b-2 border-blue-600 pb-1 transition-colors";
        btnAstuces.className = "text-slate-500 hover:text-blue-600 border-b-2 border-transparent pb-1 transition-colors";
    } else {
        vueSuivi.classList.replace('block', 'hidden');
        vueAstuces.classList.replace('hidden', 'block');
        
        btnAstuces.className = "text-blue-600 border-b-2 border-blue-600 pb-1 transition-colors";
        btnSuivi.className = "text-slate-500 hover:text-blue-600 border-b-2 border-transparent pb-1 transition-colors";
        
        initialiserSelectAstuces();
    }
}

// Initialise le menu déroulant avec la liste complète de tes tests
function initialiserSelectAstuces() {
    const select = document.getElementById('select-test-astuce');
    if (select.options.length <= 1) {
        select.innerHTML = '<option value="">-- Choisir un exercice --</option>';
        tousLesExercices.forEach(ex => {
            const option = document.createElement('option');
            option.value = ex;
            option.textContent = ex;
            select.appendChild(option);
        });
        
        // Charger avec le premier exercice disponible par défaut
        if(tousLesExercices.length > 0) {
            select.value = tousLesExercices[0];
            chargerAstuces();
        }
    }
}

// Affiche les cartes d'astuces depuis Supabase pour le test sélectionné
window.chargerAstuces = function() {
    const select = document.getElementById('select-test-astuce');
    const grille = document.getElementById('grille-astuces');
    const exerciceChoisi = select.value;

    if (!exerciceChoisi) {
        grille.innerHTML = `<div class="col-span-full text-center py-12 text-slate-400 text-sm">Sélectionne un test pour voir tes astuces.</div>`;
        return;
    }

    const astucesFiltrees = astucesGlobales.filter(a => a.exercice === exerciceChoisi);

    if (astucesFiltrees.length === 0) {
        grille.innerHTML = `
            <div class="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center">
                <p class="text-slate-500 font-medium mb-2">Aucune astuce enregistrée pour ce test.</p>
                <p class="text-sm text-slate-400">Clique sur "+ Nouvelle Astuce" pour créer ta première fiche de révision.</p>
            </div>`;
        return;
    }

    grille.innerHTML = '';
    astucesFiltrees.forEach(astuce => {
        const contenuFormate = astuce.contenu.replace(/\n/g, '<br>');
        
        // C'est ici que l'image s'affiche. On utilise object-contain pour que l'image entière de la grille (ex: Raven) soit visible sans rognage.
        let imageHtml = '';
        if (astuce.image_url) {
            imageHtml = `
                <div class="w-full bg-slate-100 border-b border-slate-200 overflow-hidden flex items-center justify-center p-2" style="min-height: 200px;">
                    <img src="${astuce.image_url}" alt="${astuce.titre}" class="max-w-full max-h-[400px] object-contain rounded">
                </div>
            `;
        }

        grille.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                ${imageHtml}
                <div class="p-5 flex-1">
                    <h3 class="font-bold text-slate-800 mb-3 text-lg">${astuce.titre}</h3>
                    <p class="text-sm text-slate-600 leading-relaxed">${contenuFormate}</p>
                </div>
                <div class="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onclick="supprimerAstuce(${astuce.id})" class="text-xs font-semibold text-slate-400 hover:text-red-600">🗑️ Supprimer</button>
                </div>
            </div>
        `;
    });
}

// --- MODALE D'AJOUT D'ASTUCES ---
window.ouvrirModalAjoutAstuce = function() {
    document.getElementById('modal-ajout-astuce').classList.remove('hidden');
    
    // Remplit le menu déroulant du formulaire avec tous les tests
    const selectModal = document.getElementById('modal-astuce-exercice');
    selectModal.innerHTML = '';
    tousLesExercices.forEach(ex => {
        const option = document.createElement('option');
        option.value = ex;
        option.textContent = ex;
        selectModal.appendChild(option);
    });
    
    // Si un exercice est déjà sélectionné dans la page, on le pré-sélectionne dans le formulaire
    const selectPage = document.getElementById('select-test-astuce').value;
    if (selectPage) selectModal.value = selectPage;
}

window.fermerModalAjoutAstuce = function() {
    document.getElementById('modal-ajout-astuce').classList.add('hidden');
    // Réinitialise le formulaire
    document.getElementById('modal-astuce-titre').value = '';
    document.getElementById('modal-astuce-contenu').value = '';
    document.getElementById('modal-astuce-image').value = '';
}

window.sauvegarderAstuce = async function() {
    const exercice = document.getElementById('modal-astuce-exercice').value;
    const titre = document.getElementById('modal-astuce-titre').value.trim();
    const contenu = document.getElementById('modal-astuce-contenu').value.trim();
    const imageUrl = document.getElementById('modal-astuce-image').value.trim();

    if (!titre || !contenu) {
        alert("Le titre et le contenu sont obligatoires.");
        return;
    }

    const nouvelleAstuce = {
        exercice: exercice,
        titre: titre,
        contenu: contenu,
        image_url: imageUrl || null
    };

    // 1. Envoi à Supabase
    const { error } = await supabaseClient.from('astuces').insert([nouvelleAstuce]);
    
    if (error) {
        alert("Erreur lors de la sauvegarde : " + error.message);
        return;
    }

    // 2. Recharge les données depuis le cloud pour mettre à jour l'affichage
    const { data: astucesData } = await supabaseClient.from('astuces').select('*').order('id', { ascending: false });
    astucesGlobales = astucesData || [];
    
    // 3. Ferme et rafraîchit la grille
    fermerModalAjoutAstuce();
    document.getElementById('select-test-astuce').value = exercice; // Bascule sur le bon test
    chargerAstuces();
}

window.supprimerAstuce = async function(idAstuce) {
    if (!confirm("Voulez-vous vraiment supprimer cette astuce ?")) return;
    
    await supabaseClient.from('astuces').delete().eq('id', idAstuce);
    
    // Recharger la liste locale
    astucesGlobales = astucesGlobales.filter(a => a.id !== idAstuce);
    chargerAstuces();
}

// --- DÉMARRAGE ---
async function demarrerDashboard() {
    await chargerDonnees();
    afficherNavigationGroupes();
    initFormulaire();
    genererBandeauxEtGraphiquesGlobaux();
    
    // Pour être sûr que le sélecteur d'astuces soit prêt
    if(document.getElementById('vue-astuces').classList.contains('block')) {
        initialiserSelectAstuces();
    }
}

demarrerDashboard();