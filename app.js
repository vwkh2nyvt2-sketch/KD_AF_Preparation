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
let exerciceActuelDrawer = null;
let miniCharts = {};

// --- 3. CHARGEMENT DEPUIS LE CLOUD ---
async function chargerDonnees() {
    tousLesExercices.forEach(ex => statsGlobales[ex] = { scores: [], dates: [], ids: [] });

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

const getPointColor = (val) => {
    if (val <= 2) return '#ef4444';
    if (val <= 4) return '#f59e0b';
    if (val <= 7) return '#10b981';
    return '#3b82f6';
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
    if(titreDroite) titreDroite.textContent = groupeActif === 'Tous' ? 'Tous les exercices' : `Groupe : ${groupeActif}`;

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
        btn.className = "w-8 h-8 rounded text-white font-bold text-xs transition-transform hover:scale-110 active:scale-95 shadow-sm";
        btn.style.backgroundColor = getPointColor(i);
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
    genererGrilleDroite();
}

// --- RENDU GLOBAL GAUCHE ---
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

// --- RENDU DIRECT DES CATÉGORIES ET DE LEURS EXERCICES DANS LE BANDEAU ---
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

    if (nomsCats.length === 0) {
        container.innerHTML = `
            <div class="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Aucune catégorie créée pour ce groupe.<br>Cliquez sur <strong>"⚙️ Éditer / Créer"</strong> ci-dessus pour en ajouter.
            </div>`;
        return;
    }

    nomsCats.forEach(nomCat => {
        const exList = (sousCats[nomCat] || []).filter(ex => exercicesDuGroupe.includes(ex));
        
        let htmlExercicesDansCat = '';
        if (exList.length === 0) {
            htmlExercicesDansCat = `<div class="p-3 text-[11px] text-slate-400 italic text-center">Aucun exercice dans cette catégorie.</div>`;
        } else {
            exList.forEach(ex => {
                htmlExercicesDansCat += rendreLigneExerciceCompacte(ex);
            });
        }

        container.innerHTML += `
            <div class="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div class="bg-slate-100 px-4 py-2.5 flex justify-between items-center border-b border-slate-200">
                    <span class="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        📁 ${nomCat} <span class="text-[10px] text-slate-400 font-normal">(${exList.length} test(s))</span>
                    </span>
                    <button onclick="editerCategorie('${nomCat}')" class="text-slate-400 hover:text-indigo-600 p-1 text-xs font-bold" title="Modifier cette catégorie">⚙️</button>
                </div>
                <div class="divide-y divide-slate-100 bg-white">
                    ${htmlExercicesDansCat}
                </div>
            </div>
        `;
    });
}

// Ligne d'exercice compacte
function rendreLigneExerciceCompacte(ex) {
    const donnees = statsGlobales[ex] || { scores: [], dates: [], ids: [] };
    const nbEssais = donnees.scores.length;
    let moyenne = '-';
    let dernier = '-';

    if (nbEssais > 0) {
        const somme = donnees.scores.reduce((a, b) => a + b, 0);
        moyenne = Math.round(somme / nbEssais);
        dernier = donnees.scores[nbEssais - 1];
    }

    const bgMoyenne = moyenne !== '-' ? getPointColor(moyenne) : '#f1f5f9';
    const textMoyenne = moyenne !== '-' ? '#ffffff' : '#94a3b8';
    const textDernier = dernier !== '-' ? getPointColor(dernier) : '#94a3b8';

    let htmlCarres = '';
    for (let i = 1; i <= 9; i++) {
        const atteint = donnees.scores.includes(i);
        const couleur = atteint ? getPointColor(i) : '#f1f5f9';
        const textColor = atteint ? '#ffffff' : '#cbd5e1';
        htmlCarres += `<div class="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold" style="background-color: ${couleur}; color: ${textColor}">${i}</div>`;
    }

    return `
        <div onclick="ouvrirDrawer('${ex}')" class="grid grid-cols-12 gap-2 p-2.5 items-center hover:bg-slate-50 transition-colors cursor-pointer text-xs">
            <div class="col-span-6 flex items-center gap-2">
                <div>
                    <div class="font-semibold text-slate-800 text-xs">${ex}</div>
                    <div class="text-[10px] text-slate-400">${nbEssais} essai(s)</div>
                </div>
            </div>
            <div class="col-span-4 flex items-center justify-center gap-0.5">
                ${htmlCarres}
            </div>
            <div class="col-span-1 flex justify-center">
                <div class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shadow-sm" style="background-color: ${bgMoyenne}; color: ${textMoyenne}">${moyenne}</div>
            </div>
            <div class="col-span-1 flex justify-center">
                <div class="w-5 h-5 flex items-center justify-center font-bold text-xs" style="color: ${textDernier}">${dernier}</div>
            </div>
        </div>
    `;
}

// --- MODALE DE GESTION DES CATÉGORIES ---
window.ouvrirModalCategories = function(nomCatEdit = null) {
    if (groupeActif === 'Tous') return;
    document.getElementById('modal-categories').classList.remove('hidden');
    
    let g = groupesPersonnalisés[groupeActif];
    if (Array.isArray(g)) g = { exercices: g, sousCategories: {} };
    const exercicesDuGroupe = g.exercices || [];

    const containerCheck = document.getElementById('liste-checkboxes-exercices-groupe');
    containerCheck.innerHTML = '';

    if (exercicesDuGroupe.length === 0) {
        containerCheck.innerHTML = `<span class="text-xs text-slate-400 col-span-2 text-center py-4">Ce groupe ne contient aucun exercice. Ajoutez-en d'abord via "Gérer les Groupes".</span>`;
    } else {
        exercicesDuGroupe.forEach(ex => {
            containerCheck.innerHTML += `
                <label class="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 cursor-pointer hover:bg-indigo-50">
                    <input type="checkbox" name="cat-ex-checkbox" value="${ex}" class="rounded text-indigo-600">
                    <span class="truncate">${ex}</span>
                </label>
            `;
        });
    }

    rendreListeCategoriesExistantesModal();

    if (nomCatEdit) {
        document.getElementById('modal-cat-titre').textContent = `Modifier la catégorie : ${nomCatEdit}`;
        document.getElementById('edit-cat-ancien-nom').value = nomCatEdit;
        document.getElementById('input-nom-cat').value = nomCatEdit;
        
        const dejaCoches = g.sousCategories[nomCatEdit] || [];
        const inputs = containerCheck.querySelectorAll('input[name="cat-ex-checkbox"]');
        inputs.forEach(inp => {
            if (dejaCoches.includes(inp.value)) inp.checked = true;
        });
    } else {
        document.getElementById('modal-cat-titre').textContent = 'Gérer les catégories';
        document.getElementById('edit-cat-ancien-nom').value = '';
        document.getElementById('input-nom-cat').value = '';
    }
}

window.fermerModalCategories = function() {
    document.getElementById('modal-categories').classList.add('hidden');
    afficherNavigationGroupes();
    genererBandeauxEtGraphiquesGlobaux();
}

window.annulerEditionCategorie = function() {
    document.getElementById('input-nom-cat').value = '';
    document.getElementById('edit-cat-ancien-nom').value = '';
    document.getElementById('modal-cat-titre').textContent = 'Gérer les catégories';
    const inputs = document.querySelectorAll('input[name="cat-ex-checkbox"]');
    inputs.forEach(inp => inp.checked = false);
}

window.validerEnregistrementCategorie = async function() {
    if (groupeActif === 'Tous') return;
    const nomCatInput = document.getElementById('input-nom-cat').value.trim();
    const ancienNom = document.getElementById('edit-cat-ancien-nom').value.trim();

    if (!nomCatInput) {
        alert("Veuillez donner un nom à la catégorie.");
        return;
    }

    let g = groupesPersonnalisés[groupeActif];
    if (Array.isArray(g)) g = { exercices: g, sousCategories: {} };
    if (!g.sousCategories) g.sousCategories = {};

    const checkboxes = document.querySelectorAll('input[name="cat-ex-checkbox"]:checked');
    const exercicesSelectionnes = Array.from(checkboxes).map(cb => cb.value);

    if (ancienNom && ancienNom !== nomCatInput) {
        delete g.sousCategories[ancienNom];
    }

    g.sousCategories[nomCatInput] = exercicesSelectionnes;
    groupesPersonnalisés[groupeActif] = g;

    await sauvegarderGroupesDansCloud();
    annulerEditionCategorie();
    rendreListeCategoriesExistantesModal();
    afficherNavigationGroupes();
    genererBandeauxEtGraphiquesGlobaux();
}

window.editerCategorie = function(nomCat) {
    ouvrirModalCategories(nomCat);
}

window.supprimerCategorieModal = async function(nomCat) {
    if (!confirm(`Voulez-vous vraiment supprimer la catégorie "${nomCat}" ?`)) return;
    let g = groupesPersonnalisés[groupeActif];
    if (g && g.sousCategories) {
        delete g.sousCategories[nomCat];
        groupesPersonnalisés[groupeActif] = g;
        await sauvegarderGroupesDansCloud();
        rendreListeCategoriesExistantesModal();
        afficherNavigationGroupes();
        genererBandeauxEtGraphiquesGlobaux();
    }
}

function rendreListeCategoriesExistantesModal() {
    const container = document.getElementById('liste-categories-existantes');
    if (!container) return;
    container.innerHTML = '';

    let g = groupesPersonnalisés[groupeActif];
    if (Array.isArray(g)) g = { exercices: g, sousCategories: {} };
    const sousCats = g.sousCategories || {};
    const nomsCats = Object.keys(sousCats);

    if (nomsCats.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-2">Aucune catégorie enregistrée pour ce groupe.</p>`;
        return;
    }

    nomsCats.forEach(nomCat => {
        const list = sousCats[nomCat] || [];
        container.innerHTML += `
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center">
                <div>
                    <span class="font-bold text-xs text-slate-800">📁 ${nomCat}</span>
                    <div class="text-[10px] text-slate-400 mt-0.5">${list.join(', ') || 'Aucun exercice'}</div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="editerCategorie('${nomCat}')" class="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 p-1.5 rounded-lg text-xs">⚙️ Éditer</button>
                    <button onclick="supprimerCategorieModal('${nomCat}')" class="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-lg text-xs">🗑️</button>
                </div>
            </div>
        `;
    });
}

// --- AFFICHAGE COLONNE DE DROITE (Grille de Mini-Courbes) ---
function genererGrilleDroite() {
    const grilleContainer = document.getElementById('grille-mini-courbes');
    if (!grilleContainer) return;
    grilleContainer.innerHTML = '';

    Object.values(miniCharts).forEach(chart => chart.destroy());
    miniCharts = {};

    let exercicesAffiches = tousLesExercices;
    if (groupeActif !== "Tous" && groupesPersonnalisés[groupeActif]) {
        let g = groupesPersonnalisés[groupeActif];
        if (Array.isArray(g)) g = { exercices: g, sousCategories: {} };
        exercicesAffiches = g.exercices || [];
    }

    if (exercicesAffiches.length === 0) {
        grilleContainer.innerHTML = `<p class="text-xs text-slate-400 col-span-2 text-center py-12">Aucun exercice dans ce groupe.</p>`;
        return;
    }

    exercicesAffiches.forEach((ex, index) => {
        const donnees = statsGlobales[ex] || { scores: [], dates: [] };
        const nbEssais = donnees.scores.length;
        const dernier = nbEssais > 0 ? donnees.scores[nbEssais - 1] : '-';
        const couleurDernier = dernier !== '-' ? getPointColor(dernier) : '#94a3b8';

        const carteId = `mini-chart-${index}`;
        const cardHtml = `
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col justify-between">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-xs text-slate-700 truncate max-w-[70%]" title="${ex}">${ex}</span>
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded text-white" style="background-color: ${couleurDernier}">Dernier : ${dernier}</span>
                </div>
                <div class="relative h-32 w-full">
                    <canvas id="${carteId}"></canvas>
                </div>
            </div>
        `;
        grilleContainer.innerHTML += cardHtml;

        setTimeout(() => {
            const canvasEl = document.getElementById(carteId);
            if (canvasEl) {
                const ctx = canvasEl.getContext('2d');
                miniCharts[carteId] = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: donnees.dates,
                        datasets: [{
                            data: donnees.scores,
                            borderColor: '#3b82f6',
                            borderWidth: 2,
                            tension: 0.1,
                            pointBackgroundColor: context => getPointColor(context.raw),
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { min: 1, max: 9, ticks: { stepSize: 2, font: { size: 9 } }, grid: { color: '#f1f5f9' } },
                            x: { display: false }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            }
        }, 50);
    });
}

// --- 6. GESTION DU PANNEAU LATÉRAL (TIROIR) ---
window.ouvrirDrawer = function(nomExercice) {
    exerciceActuelDrawer = nomExercice;
    document.getElementById('drawer-titre-exercice').textContent = nomExercice;
    document.getElementById('drawer-detail').classList.remove('hidden');

    const donnees = statsGlobales[nomExercice] || { scores: [], dates: [], ids: [] };
    const nbEssais = donnees.scores.length;

    document.getElementById('drawer-sous-titre').textContent = `Exercice Pilotest • ${nbEssais} essai(s) au total`;
    document.getElementById('drawer-sous-titre-regularite').textContent = `${nbEssais} essai(s) au total sur la période`;

    let moyenne = '-';
    let dernier = '-';
    let record = '-';
    let dateRecord = 'Aucun record';

    if (nbEssais > 0) {
        const somme = donnees.scores.reduce((a, b) => a + b, 0);
        moyenne = Math.round(somme / nbEssais);
        dernier = donnees.scores[nbEssais - 1];
        
        let maxScore = Math.max(...donnees.scores);
        record = maxScore;
        let indexRecord = donnees.scores.indexOf(maxScore);
        dateRecord = donnees.dates[indexRecord] || '';
    }

    const boxMoy = document.getElementById('drawer-stat-moyenne');
    boxMoy.textContent = moyenne;
    boxMoy.style.color = moyenne !== '-' ? getPointColor(moyenne) : '#64748b';

    const boxDer = document.getElementById('drawer-stat-dernier');
    boxDer.textContent = dernier;
    boxDer.style.color = dernier !== '-' ? getPointColor(dernier) : '#64748b';

    const boxRec = document.getElementById('drawer-stat-record');
    boxRec.textContent = record;
    boxRec.style.color = record !== '-' ? getPointColor(record) : '#64748b';
    document.getElementById('drawer-date-record').textContent = dateRecord ? `le ${dateRecord}` : 'meilleur score';

    rendreGraphiqueBarres(donnees.scores);
    rendreGraphiqueLigne(donnees);
    rendreListeEssais(donnees);
}

window.fermerDrawer = function() {
    document.getElementById('drawer-detail').classList.add('hidden');
}

function rendreGraphiqueBarres(scores) {
    const counts = Array(9).fill(0);
    scores.forEach(s => {
        if (s >= 1 && s <= 9) counts[s - 1]++;
    });

    const ctx = document.getElementById('barChart').getContext('2d');
    if (barChart != null) barChart.destroy();

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
            datasets: [{
                data: counts,
                backgroundColor: [1,2,3,4,5,6,7,8,9].map(i => getPointColor(i)),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function rendreGraphiqueLigne(donnees) {
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    if (evolutionChart != null) evolutionChart.destroy();

    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: donnees.dates,
            datasets: [{
                label: 'Score Stanine',
                data: donnees.scores,
                borderColor: '#3b82f6',
                borderWidth: 2.5,
                tension: 0.1,
                pointBackgroundColor: context => getPointColor(context.raw),
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 1, max: 9, ticks: { stepSize: 1, font: { weight: 'bold' } }, grid: { color: '#f1f5f9' } },
                x: { ticks: { maxTicksLimit: 10, font: { size: 10 } }, grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function rendreListeEssais(donnees) {
    const container = document.getElementById('drawer-liste-essais');
    container.innerHTML = '';

    if (!donnees.scores || donnees.scores.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Aucun essai enregistré pour cet exercice.</p>`;
        return;
    }

    for (let i = donnees.scores.length - 1; i >= 0; i--) {
        const score = donnees.scores[i];
        const date = donnees.dates[i];
        const idScore = donnees.ids[i];
        const couleur = getPointColor(score);

        container.innerHTML += `
            <div class="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs shadow-2xs">
                <span class="text-slate-500 font-medium">Essai du ${date}</span>
                <div class="flex items-center gap-3">
                    <span class="font-bold px-2.5 py-1 rounded-lg text-white" style="background-color: ${couleur}">Stanine ${score}</span>
                    <button onclick="supprimerScore(${idScore}, '${exerciceActuelDrawer}')" class="text-slate-400 hover:text-red-600 font-bold p-1 transition-colors" title="Supprimer cet essai">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }
}

window.supprimerScore = async function(idScore, nomExercice) {
    if (!confirm("Voulez-vous vraiment supprimer cet essai ?")) return;

    const { error } = await supabaseClient.from('scores').delete().eq('id', idScore);
    if (error) { alert("❌ Erreur : " + error.message); return; }

    await chargerDonnees();
    genererBandeauxEtGraphiquesGlobaux();
    ouvrirDrawer(nomExercice);
}

// --- 7. EXPORT EXCEL ---
window.exporterVersExcel = async function() {
    const { data: scoresData, error } = await supabaseClient.from('scores').select('*').order('id', { ascending: true });
    if (error || !scoresData || scoresData.length === 0) { alert("⚠️ Aucun score à exporter !"); return; }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Date;Exercice;Score Stanine\n";
    scoresData.forEach(row => { csvContent += `${row.date_test};${row.exercice};${row.score_stanine}\n`; });

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `suivi_cadets_pilotest_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

// --- 8. MODALE DE GESTION DES GROUPES ---
window.ouvrirModalGroupes = function() {
    document.getElementById('modal-groupes').classList.remove('hidden');
    rendreInterfaceGestionGroupes();
}
window.fermerModalGroupes = function() {
    document.getElementById('modal-groupes').classList.add('hidden');
    afficherNavigationGroupes();
    initialiserFormulaireSelect();
    genererBandeauxEtGraphiquesGlobaux();
}
window.creerGroupe = async function() {
    const input = document.getElementById('input-nom-groupe');
    const nom = input.value.trim();
    if (!nom) return;
    if (groupesPersonnalisés[nom]) { alert("Ce groupe existe déjà !"); return; }
    
    groupesPersonnalisés[nom] = { exercices: [], sousCategories: {} };
    await sauvegarderGroupesDansCloud();
    input.value = '';
    rendreInterfaceGestionGroupes();
}
window.supprimerGroupe = async function(nomGroupe) {
    if (confirm(`Voulez-vous supprimer le groupe "${nomGroupe}" ?`)) {
        delete groupesPersonnalisés[nomGroupe];
        if (groupeActif === nomGroupe) groupeActif = "Tous";
        await supprimerGroupeDansCloud(nomGroupe);
        rendreInterfaceGestionGroupes();
    }
}

window.basculerExerciceDansGroupe = async function(nomGroupe, nomExercice) {
    let g = groupesPersonnalisés[nomGroupe];
    if (!g) return;
    if (Array.isArray(g)) g = { exercices: g, sousCategories: {} };

    const idx = g.exercices.indexOf(nomExercice);
    if (idx > -1) {
        g.exercices.splice(idx, 1);
        Object.keys(g.sousCategories).forEach(cat => {
            const subIdx = g.sousCategories[cat].indexOf(nomExercice);
            if (subIdx > -1) g.sousCategories[cat].splice(subIdx, 1);
        });
    } else {
        g.exercices.push(nomExercice);
    }
    groupesPersonnalisés[nomGroupe] = g;
    await sauvegarderGroupesDansCloud();
    rendreInterfaceGestionGroupes();
}

function rendreInterfaceGestionGroupes() {
    const container = document.getElementById('liste-gestion-groupes');
    if(!container) return;
    container.innerHTML = '';
    const clesGroupes = Object.keys(groupesPersonnalisés);
    if (clesGroupes.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400 text-center py-4">Aucun groupe pour l'instant.</p>`;
        return;
    }
    clesGroupes.forEach(nomGroupe => {
        let g = groupesPersonnalisés[nomGroupe];
        if (Array.isArray(g)) g = { exercices: g, sousCategories: {} };
        const exercicesDuGroupe = g.exercices || [];

        let htmlExercicesDispos = '';
        tousLesExercices.forEach(ex => {
            const estInclus = exercicesDuGroupe.includes(ex);
            htmlExercicesDispos += `
                <label class="flex items-center gap-2 text-xs text-slate-700 bg-white p-1.5 rounded border border-slate-200 cursor-pointer hover:bg-blue-50">
                    <input type="checkbox" ${estInclus ? 'checked' : ''} onchange="basculerExerciceDansGroupe('${nomGroupe}', '${ex}')" class="rounded text-blue-600 focus:ring-blue-500">
                    <span class="truncate">${ex}</span>
                </label>
            `;
        });

        container.innerHTML += `
            <div class="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div class="flex justify-between items-center border-b pb-2">
                    <h5 class="font-bold text-sm text-slate-800">📁 ${nomGroupe} (${exercicesDuGroupe.length} tests)</h5>
                    <button onclick="supprimerGroupe('${nomGroupe}')" class="text-xs text-red-500 hover:text-red-700 font-medium">Supprimer</button>
                </div>
                <div class="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-100 rounded-lg">
                    ${htmlExercicesDispos}
                </div>
            </div>
        `;
    });
}

// --- 9. DÉMARRAGE ---
async function demarrerDashboard() {
    await chargerDonnees();
    afficherNavigationGroupes();
    initFormulaire();
    genererBandeauxEtGraphiquesGlobaux();
}

demarrerDashboard();