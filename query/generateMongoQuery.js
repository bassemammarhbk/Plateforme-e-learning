const axios = require("axios");
const { ObjectId } = require("mongodb");

const generateMongoQuery = async (userQuery) => {
  try {
    if (!userQuery || typeof userQuery !== "string") {
      throw new Error("La requête utilisateur est invalide.");
    }
    console.log("Envoi de la requête à LLaMA...");
    const response = await axios.post(process.env.OLLAMA_API_URL, {
      model: process.env.OLLAMA_MODEL,
      stream: false,
      prompt: `

Tu es un expert en bases de données et NLP. Analyse la requête utilisateur et génère une
requête MongoDB au format JSON pour interroger la collection 'Cours'.
N'inclus que du JSON, sans texte explicatif.

### Exemples :
- "Trouve-moi le cours intitulé 'Introduction à HTML'"
→ { "filter": { "nomcours": "Introduction à HTML" } }

- "Quels sont les cours de niveau débutant ?"
→ { "filter": { "niveau": "debutant" } }

- "Quels sont les cours de niveau avancé ?"
→ { "filter": { "niveau": "avancé" } }

- "Liste les cours pour les intermédiaires"
→ { "filter": { "niveau": "intermediaire" } }

- "Liste les cours de la filière 'Informatique'"
→ { "filter": { "sousFiliereId.filiereId.nomfiliere": "Informatique" } }

- "Affiche les cours avec une durée inférieure à 50h"
→ { "filter": { "duree": { "$lt": "50h" } } }

- "Quels sont les 3 cours les plus récents ?"
→ { "sort": { "createdAt": -1 }, "limit": 3 }

- "Montre-moi les cours triés par nom"
→ { "sort": { "nomcours": 1 } }

- "Quels sont les cours de la sous-filière 'Développement web' ?"
→ { "filter": { "sousFiliereId.nomSousFiliere": "Développement web" } }

### Requête :
"${userQuery}"
`,
      max_tokens: 150,
    });
    console.log("Réponse brute de LLaMA:", response.data);
    const queryIntent = response.data.response?.trim();
    if (!queryIntent) {
      throw new Error("Réponse invalide de LLaMA.");
    }
    console.log("Interprétation LLaMA:", queryIntent);
    let parsedQuery;
    try {
      parsedQuery = JSON.parse(queryIntent);
    } catch (jsonError) {
      console.error("Erreur de parsing JSON:", jsonError);
      return { filter: {} };
    }

    // Fonction de correction avancée
    function correctMongoQuery(query) {
      if (!query.filter) return query;

      // Correction pour les IDs de sous-filière
      if (query.filter.sousFiliereId) {
        let id = query.filter.sousFiliereId;
        if (typeof id === "string" && id.match(/^[0-9a-fA-F]{24}$/)) {
          query.filter.sousFiliereId = new ObjectId(id);
        } else {
          delete query.filter.sousFiliereId; // Supprime si invalide
        }
      }

      return query;
    }

    const correctedQuery = correctMongoQuery(parsedQuery);
    console.log("Requête corrigée :", JSON.stringify(correctedQuery, null, 2));
    return correctedQuery;
  } catch (error) {
    console.error("Erreur lors de la génération de la requête:", error.message);
    return { filter: {} };
  }
};

module.exports = { generateMongoQuery };