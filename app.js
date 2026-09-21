// --- 1. LISTE DE TOUS LES EXERCICES ---
const tousLesExercices = [
    "Airways", "Ami ou ennemi", "Anglais", "Angles",
    "Angles à cocher", "Angles à saisir", "Attention 1", "Attention 2", 
    "Attention 2 + Tâches Perturbatrices", "Attention 3", "BLS IV",
    "Calcul mental 1", "Calcul mental 2", "Calcul mental 3", "Calcul mental 4",
    "Chaise (point de vue)", "Lecture de texte", "Mathématiques", "Matrices de Raven",
    "Mémoire de travail I", "Mémoire de travail II", "Patrons de cubes - PSY1",
    "Psychomoteur ENAC", "Tangram à compléter", "Tangram à proposition",
    "Test des compteurs", "Voiture séquentiel"
];

// --- 2. GESTION DE LA MÉMOIRE LOCALE ---
let statsGlobales = {};
let groupesPersonnalisés = {}; 
let groupeActif = "Tous";
let evolutionChart = null;

function chargerDonnees() {
    // 1. Charger les scores
    const scoresSave = localStorage.getItem('cadets_scores');
    if (scoresSave) statsGlobales = JSON.parse(scoresSave);

    tousLesExercices.forEach(ex => {
        if (!statsGlobales[ex]) statsGlobales[ex] = { scores: [], dates: [] };
    });

    // 2. Charger les groupes
    const groupesSave = localStorage.getItem('cadets_groupes');
    if (groupesSave) {
        groupesPersonnalisés = JSON.parse(groupesSave);
    } else {
        groupesPersonnalisés = {
            "PSY0": ["Calcul mental 1", "Calcul mental 2", "Calcul mental 3", "Calcul mental 4", "Mathématiques"],
            "PSY1": ["Airways", "Angles", "Attention 1", "Patrons de cubes - PSY1"]
        };
        sauvegarderGroupes();
    }
}

function sauvegarderScores() {
    localStorage.setItem('cadets_scores', JSON.stringify(statsGlobales));
}

function sauvegarderGroupes() {
    localStorage.setItem('cadets_groupes', JSON.stringify(groupesPersonnalisés));
}

const getPointColor = (val) => {
    if (val <= 2) return '#ef4444';
    if (val <= 4) return '#f59e0b';
    if (val <= 7) return '#10b981';
    return '#3b82f6';
};

// --- 3. RENDU DES BOUTONS DE NAVIGATION DES GROUPES ---
function afficherNavigationGroupes() {
    const navContainer = document.getElementById('groupes-nav');
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

    document.getElementById('label-groupe-actif').textContent = `Groupe : ${groupeActif}`;
}

function changerGroupe(nomGroupe) {
    groupeActif = nomGroupe;
    afficherNavigationGroupes();
    initialiserFormulaireSelect();
    genererBandeaux();
}

// --- 4. FORMULAIRE D'AJOUT DE TEST (Filtré par groupe) ---
function initFormulaire() {
    const zoneBoutons = document.getElementById('zone-boutons-stanine');
    for (let i = 1; i <= 9; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = "w-10 h-10 rounded text-white font-bold transition-transform hover:scale-110 active:scale-95 shadow-sm";
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
    select.innerHTML = '<option value="">-- Sélectionner un test --</option>';

    let exercicesDisponibles = tousLesExercices;
    if (groupeActif !== "Tous" && groupesPersonnalisés[groupeActif]) {
        exercicesDisponibles = groupesPersonnalisés[groupeActif];
    }

    exercicesDisponibles.forEach(ex => {
        const option = document.createElement('option');
        option.value = ex;
        option.textContent = ex;
        select.appendChild(option);
    });

    document.getElementById('zone-boutons-stanine').classList.add('opacity-30', 'pointer-events-none');
}

function enregistrerScore(scoreStanine) {
    const exerciceSelectionne = document.getElementById('select-exercice').value;
    if (!exerciceSelectionne) return;

    const dateJour = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

    statsGlobales[exerciceSelectionne].scores.push(scoreStanine);
    statsGlobales[exerciceSelectionne].dates.push(dateJour);
    sauvegarderScores();

    const message = document.getElementById('message-confirmation');
    message.classList.remove('hidden');
    setTimeout(() => message.classList.add('hidden'), 3000);

    genererBandeaux();
    afficherGraphique(exerciceSelectionne);
}

// --- 5. GÉNÉRATION DES BANDEAUX (Filtrés par groupe) ---
function genererBandeaux() {
    const container = document.getElementById('exercices-list');
    container.innerHTML = '';

    let exercicesAffiches = tousLesExercices;
    if (groupeActif !== "Tous" && groupesPersonnalisés[groupeActif]) {
        exercicesAffiches = groupesPersonnalisés[groupeActif];
    }

    if (exercicesAffiches.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-slate-400 text-sm">Aucun exercice dans ce groupe pour le moment. Cliquez sur "Créer / Modifier les groupes" pour en ajouter.</div>`;
        return;
    }

    exercicesAffiches.forEach(ex => {
        const donnees = statsGlobales[ex] || { scores: [], dates: [] };
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

        const html = `
            <div onclick="afficherGraphique('${ex}')" class="grid grid-cols-12 gap-4 p-4 items-center border-l-4 border-transparent hover:border-blue-500 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100">
                <div class="col-span-8 flex items-center gap-3">
                    <span class="bg-indigo-100 text-indigo-600 text-xs font-bold px-2 py-1 rounded">PT</span>
                    <div>
                        <div class="font-semibold text-slate-800">${ex}</div>
                        <div class="text-xs text-slate-500">${nbEssais > 0 ? nbEssais + ' essai(s)' : 'Aucun essai'}</div>
                    </div>
                </div>
                <div class="col-span-2 flex justify-center">
                    <div class="w-8 h-8 rounded flex items-center justify-center font-bold shadow-sm" style="background-color: ${bgMoyenne}; color: ${textMoyenne}">${moyenne}</div>
                </div>
                <div class="col-span-2 flex justify-center">
                    <div class="w-8 h-8 flex items-center justify-center font-bold text-lg" style="color: ${textDernier}">${dernier}</div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// --- 6. GESTION DU GRAPHIQUE ---
window.afficherGraphique = function(nomExercice) {
    document.getElementById('titre-graphique').innerText = `ÉVOLUTION - ${nomExercice.toUpperCase()}`;
    const donnees = statsGlobales[nomExercice] || { scores: [], dates: [] };
    const ctx = document.getElementById('evolutionChart').getContext('2d');

    if (evolutionChart != null) {
        evolutionChart.destroy();
    }

    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: donnees.dates,
            datasets: [{
                label: 'Score Stanine',
                data: donnees.scores,
                borderColor: '#3b82f6',
                borderWidth: 2,
                tension: 0.1,
                pointBackgroundColor: context => getPointColor(context.raw),
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 10, bottom: 10 } },
            scales: {
                y: { min: 1, max: 9, ticks: { stepSize: 1, color: '#3b82f6', font: { weight: 'bold' } }, grid: { color: '#f1f5f9' } },
                x: { ticks: { maxTicksLimit: 15 }, grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- 7. MODALE DE GESTION DES GROUPES ---
window.ouvrirModalGroupes = function() {
    document.getElementById('modal-groupes').classList.remove('hidden');
    rendreInterfaceGestionGroupes();
}

window.fermerModalGroupes = function() {
    document.getElementById('modal-groupes').classList.add('hidden');
    afficherNavigationGroupes();
    initialiserFormulaireSelect();
    genererBandeaux();
}

window.creerGroupe = function() {
    const input = document.getElementById('input-nom-groupe');
    const nom = input.value.trim();
    if (!nom) return;

    if (groupesPersonnalisés[nom]) {
        alert("Ce groupe existe déjà !");
        return;
    }

    groupesPersonnalisés[nom] = [];
    sauvegarderGroupes();
    input.value = '';
    rendreInterfaceGestionGroupes();
}

window.supprimerGroupe = function(nomGroupe) {
    if (confirm(`Voulez-vous vraiment supprimer le groupe "${nomGroupe}" ?`)) {
        delete groupesPersonnalisés[nomGroupe];
        if (groupeActif === nomGroupe) groupeActif = "Tous";
        sauvegarderGroupes();
        rendreInterfaceGestionGroupes();
    }
}

window.basculerExerciceDansGroupe = function(nomGroupe, nomExercice) {
    if (!groupesPersonnalisés[nomGroupe]) return;
    const index = groupesPersonnalisés[nomGroupe].indexOf(nomExercice);
    
    if (index > -1) {
        groupesPersonnalisés[nomGroupe].splice(index, 1);
    } else {
        groupesPersonnalisés[nomGroupe].push(nomExercice);
    }
    sauvegarderGroupes();
    rendreInterfaceGestionGroupes();
}

function rendreInterfaceGestionGroupes() {
    const container = document.getElementById('liste-gestion-groupes');
    container.innerHTML = '';

    const clesGroupes = Object.keys(groupesPersonnalisés);
    if (clesGroupes.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400 text-center py-4">Aucun groupe personnalisé pour l'instant.</p>`;
        return;
    }

    clesGroupes.forEach(nomGroupe => {
        const exercicesDuGroupe = groupesPersonnalisés[nomGroupe];

        let htmlExercices = '';
        tousLesExercices.forEach(ex => {
            const estInclus = exercicesDuGroupe.includes(ex);
            htmlExercices += `
                <label class="flex items-center gap-2 text-xs text-slate-700 bg-white p-1.5 rounded border border-slate-200 cursor-pointer hover:bg-blue-50">
                    <input type="checkbox" ${estInclus ? 'checked' : ''} onchange="basculerExerciceDansGroupe('${nomGroupe}', '${ex}')" class="rounded text-blue-600 focus:ring-blue-500">
                    <span class="truncate">${ex}</span>
                </label>
            `;
        });

        const bloc = `
            <div class="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div class="flex justify-between items-center mb-3">
                    <h5 class="font-bold text-sm text-slate-800">📁 ${nomGroupe} (${exercicesDuGroupe.length} tests)</h5>
                    <button onclick="supprimerGroupe('${nomGroupe}')" class="text-xs text-red-500 hover:text-red-700 font-medium">Supprimer le groupe</button>
                </div>
                <div class="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-100 rounded-lg">
                    ${htmlExercices}
                </div>
            </div>
        `;
        container.innerHTML += bloc;
    });
}

// --- DÉMARRAGE DE L'APPLICATION ---
chargerDonnees();
afficherNavigationGroupes();
initFormulaire();
genererBandeaux();
if (tousLesExercices.length > 0) {
    afficherGraphique(tousLesExercices[0]);
}