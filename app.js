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

// --- 3. CHARGEMENT DEPUIS LE CLOUD ---
async function chargerDonnees() {
    tousLesExercices.forEach(ex => statsGlobales[ex] = { scores: [], dates: [], ids: [] });

    // On s'assure de bien récupérer l'id de chaque ligne Supabase
    const { data: scoresData, error: scoresError } = await supabaseClient.from('scores').select('*').order('id', { ascending: true });
    if (!scoresError && scoresData) {
        scoresData.forEach(row => {
            if (statsGlobales[row.exercice]) {
                statsGlobales[row.exercice].scores.push(row.score_stanine);
                statsGlobales[row.exercice].dates.push(row.date_test);
                statsGlobales[row.exercice].ids.push(row.id); // <--- C'est ici que l'ID unique est stocké
            }
        });
    }

    const { data: groupesData, error: groupesError } = await supabaseClient.from('groupes').select('*');
    groupesPersonnalisés = {};
    if (!groupesError && groupesData) {
        groupesData.forEach(g => groupesPersonnalisés[g.nom] = g.exercices);
    }
}

// --- 4. SAUVEGARDE DES SCORES (MODIFIÉ : Ne rouvre plus le tiroir automatiquement) ---
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

    // On rafraîchit les bandeaux pour voir la moyenne et le dernier score se mettre à jour instantanément,
    // MAIS on ne force plus l'ouverture du tiroir de droite !
    genererBandeaux();
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

// --- 5. LOGIQUE D'INTERFACE PRINCIPALE ---
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
}

function changerGroupe(nomGroupe) {
    groupeActif = nomGroupe;
    afficherNavigationGroupes();
    initialiserFormulaireSelect();
    genererBandeaux();
}

function initFormulaire() {
    const zoneBoutons = document.getElementById('zone-boutons-stanine');
    if(!zoneBoutons) return;
    zoneBoutons.innerHTML = '<span class="text-sm text-slate-500 font-medium mr-2 flex items-center">Score :</span>';
    
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
    if(!select) return;
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

    const zoneBoutons = document.getElementById('zone-boutons-stanine');
    if(zoneBoutons) zoneBoutons.classList.add('opacity-30', 'pointer-events-none');
}

function genererBandeaux() {
    const container = document.getElementById('exercices-list');
    if(!container) return;
    container.innerHTML = '';

    let exercicesAffiches = tousLesExercices;
    if (groupeActif !== "Tous" && groupesPersonnalisés[groupeActif]) {
        exercicesAffiches = groupesPersonnalisés[groupeActif];
    }

    if (exercicesAffiches.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-slate-400 text-sm">Aucun exercice dans ce groupe pour le moment.</div>`;
        return;
    }

    exercicesAffiches.forEach(ex => {
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
            htmlCarres += `<div class="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style="background-color: ${couleur}; color: ${textColor}">${i}</div>`;
        }

        const html = `
            <div onclick="ouvrirDrawer('${ex}')" class="grid grid-cols-12 gap-4 p-4 items-center border-l-4 border-transparent hover:border-blue-500 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100">
                <div class="col-span-5 flex items-center gap-3">
                    <span class="bg-indigo-100 text-indigo-600 text-xs font-bold px-2 py-1 rounded">PT</span>
                    <div>
                        <div class="font-semibold text-slate-800">${ex}</div>
                        <div class="text-xs text-slate-500">${nbEssais} essai(s) au total</div>
                    </div>
                </div>
                <div class="col-span-5 flex items-center justify-center gap-1">
                    ${htmlCarres}
                </div>
                <div class="col-span-1 flex justify-center">
                    <div class="w-8 h-8 rounded flex items-center justify-center font-bold shadow-sm" style="background-color: ${bgMoyenne}; color: ${textMoyenne}">${moyenne}</div>
                </div>
                <div class="col-span-1 flex justify-center">
                    <div class="w-8 h-8 flex items-center justify-center font-bold text-lg" style="color: ${textDernier}">${dernier}</div>
                </div>
            </div>
        `;
        container.innerHTML += html;
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

    if (error) {
        alert("❌ Erreur lors de la suppression : " + error.message);
        console.error(error);
        return;
    }

    await chargerDonnees();
    genererBandeaux();
    ouvrirDrawer(nomExercice);
}

// --- 7. FONCTION D'EXPORTATION EXCEL (CSV) ---
window.exporterVersExcel = async function() {
    const { data: scoresData, error } = await supabaseClient.from('scores').select('*').order('id', { ascending: true });

    if (error) {
        alert("❌ Erreur lors de la récupération des données pour l'export.");
        console.error(error);
        return;
    }

    if (!scoresData || scoresData.length === 0) {
        alert("⚠️ Aucun score à exporter pour le moment !");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Date;Exercice;Score Stanine\n";

    scoresData.forEach(row => {
        csvContent += `${row.date_test};${row.exercice};${row.score_stanine}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const dateDuJour = new Date().toLocaleDateString('fr-FR').replace(/\//g, '_');
    link.setAttribute("download", `suivi_cadets_pilotest_${dateDuJour}.csv`);
    
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
    genererBandeaux();
}
window.creerGroupe = async function() {
    const input = document.getElementById('input-nom-groupe');
    const nom = input.value.trim();
    if (!nom) return;
    if (groupesPersonnalisés[nom]) { alert("Ce groupe existe déjà !"); return; }
    groupesPersonnalisés[nom] = [];
    await sauvegarderGroupesDansCloud();
    input.value = '';
    rendreInterfaceGestionGroupes();
}
window.supprimerGroupe = async function(nomGroupe) {
    if (confirm(`Voulez-vous vraiment supprimer le groupe "${nomGroupe}" ?`)) {
        delete groupesPersonnalisés[nomGroupe];
        if (groupeActif === nomGroupe) groupeActif = "Tous";
        await supprimerGroupeDansCloud(nomGroupe);
        rendreInterfaceGestionGroupes();
    }
}
window.basculerExerciceDansGroupe = async function(nomGroupe, nomExercice) {
    if (!groupesPersonnalisés[nomGroupe]) return;
    const index = groupesPersonnalisés[nomGroupe].indexOf(nomExercice);
    if (index > -1) groupesPersonnalisés[nomGroupe].splice(index, 1);
    else groupesPersonnalisés[nomGroupe].push(nomExercice);
    await sauvegarderGroupesDansCloud();
    rendreInterfaceGestionGroupes();
}

function rendreInterfaceGestionGroupes() {
    const container = document.getElementById('liste-gestion-groupes');
    if(!container) return;
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
        container.innerHTML += `
            <div class="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div class="flex justify-between items-center mb-3">
                    <h5 class="font-bold text-sm text-slate-800">📁 ${nomGroupe} (${exercicesDuGroupe.length} tests)</h5>
                    <button onclick="supprimerGroupe('${nomGroupe}')" class="text-xs text-red-500 hover:text-red-700 font-medium">Supprimer</button>
                </div>
                <div class="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-100 rounded-lg">
                    ${htmlExercices}
                </div>
            </div>
        `;
    });
}

// --- 9. DÉMARRAGE DE L'APPLICATION ---
async function demarrerDashboard() {
    await chargerDonnees();
    afficherNavigationGroupes();
    initFormulaire();
    genererBandeaux();
}

demarrerDashboard();