'use strict';

/**
 * Local Nigerian/African recipe database.
 * Used as a fallback when TheMealDB has no results.
 * Search is done by matching keywords against name + tags.
 */

const RECIPES = [
    {
        name: 'Jollof Rice',
        tags: ['jollof', 'rice', 'nigerian', 'west african', 'party rice'],
        origin: 'Nigeria / West Africa',
        servings: '4–6',
        time: '45–60 min',
        ingredients: [
            '2 cups parboiled rice',
            '400g tomato paste or blended tomatoes',
            '2 red bell peppers (blended)',
            '1 scotch bonnet pepper',
            '1 large onion',
            '3 tbsp vegetable oil',
            '2 cups chicken stock',
            '1 tsp thyme',
            '1 tsp curry powder',
            '2 seasoning cubes',
            'Salt to taste',
            '1 bay leaf',
        ],
        instructions:
            'Blend tomatoes, peppers, and half the onion. Fry in hot oil for 15–20 min until dry. Add stock, seasoning, and washed rice. Cover tightly and cook on low heat 25–30 min, stirring halfway. Finish on high heat for 2–3 min for the signature smoky bottom.',
        youtube: 'https://youtu.be/qT4lDAlHD74',
    },
    {
        name: 'Egusi Soup',
        tags: ['egusi', 'soup', 'nigerian', 'melon seed'],
        origin: 'Nigeria',
        servings: '4–6',
        time: '50 min',
        ingredients: [
            '2 cups ground egusi (melon seeds)',
            '500g assorted meat (beef, tripe, shaki)',
            '2 cups palm oil',
            '2 cups blended tomatoes & peppers',
            '1 onion',
            '2 seasoning cubes',
            'Salt to taste',
            'Stockfish (optional)',
            '1 bunch bitter leaf or ugu leaves',
        ],
        instructions:
            'Cook meat with onion and seasoning cubes until tender. Fry blended tomatoes in palm oil for 10 min. Mix egusi with a little water to form a paste, drop spoonfuls into the pot and fry for 5 min. Add meat stock, meat, stockfish, and cook 15 min. Add washed leaves, adjust salt, cook 5 more min.',
        youtube: 'https://youtu.be/QBzCFj8tFmI',
    },
    {
        name: 'Pounded Yam',
        tags: ['pounded yam', 'fufu', 'swallow', 'yam'],
        origin: 'Nigeria',
        servings: '4',
        time: '40 min',
        ingredients: [
            '1 large yam tuber (peeled, cubed)',
            'Water',
            'Salt (optional)',
        ],
        instructions:
            'Boil yam cubes in salted water until very soft (25–30 min). Drain completely. Pound in a mortar while hot, adding small amounts of hot water as needed, until smooth and stretchy with no lumps. Alternatively use a blender: blend soft yam briefly, fold with a wooden spoon until firm.',
        youtube: 'https://youtu.be/Qi8nRsRNxoU',
    },
    {
        name: 'Ofe Onugbu (Bitter Leaf Soup)',
        tags: ['bitter leaf', 'ofe onugbu', 'igbo soup', 'nigerian'],
        origin: 'Igbo, Nigeria',
        servings: '4–6',
        time: '60 min',
        ingredients: [
            '2 bunches bitter leaves (washed thoroughly)',
            '500g assorted meat',
            '1.5 cups palm oil',
            '1 cup cocoyam (ofor/achi) paste (thickener)',
            '2 seasoning cubes',
            'Stockfish & dried fish',
            '1 onion',
            'Salt & crayfish to taste',
        ],
        instructions:
            'Cook meat and fish with seasoning. Heat palm oil, add blended pepper and fry 5 min. Add meat stock and thickener, stir and cook 10 min. Add washed bitter leaves and crayfish. Simmer 15 min. Adjust seasoning.',
        youtube: '',
    },
    {
        name: 'Suya',
        tags: ['suya', 'grilled meat', 'skewer', 'nigerian bbq', 'beef'],
        origin: 'Northern Nigeria',
        servings: '4',
        time: '30 min + marinate',
        ingredients: [
            '500g beef (sirloin or flank), thinly sliced',
            '3 tbsp suya spice (yaji)',
            '2 tbsp groundnut oil',
            '1 tsp garlic powder',
            '1 tsp ginger powder',
            'Sliced onions & tomatoes (to serve)',
        ],
        instructions:
            'Mix suya spice with oil and rub all over the beef slices. Thread onto skewers and marinate 30 min. Grill or bbq on high heat 4–5 min per side until charred at edges. Serve hot with sliced onions, tomatoes, and extra suya spice.',
        youtube: 'https://youtu.be/3vf7N_OFsD0',
    },
    {
        name: 'Moi Moi',
        tags: ['moi moi', 'bean cake', 'steamed beans', 'nigerian'],
        origin: 'Nigeria',
        servings: '6',
        time: '60 min',
        ingredients: [
            '2 cups brown or black-eyed beans (peeled)',
            '2 red bell peppers',
            '1 scotch bonnet',
            '1 onion',
            '3 tbsp vegetable oil',
            '2 seasoning cubes',
            'Salt to taste',
            '2 boiled eggs, fish or corned beef (fillings)',
        ],
        instructions:
            'Soak and peel beans. Blend beans with peppers and onion into a smooth paste using minimal water. Mix in oil, seasoning, and salt. Pour into ramekins or foil cups, add filling. Steam for 45 min until firm.',
        youtube: 'https://youtu.be/tz5U88EQFU4',
    },
    {
        name: 'Ofada Rice & Ayamase Stew',
        tags: ['ofada', 'ayamase', 'designer stew', 'ofada stew', 'nigerian'],
        origin: 'Yoruba, Nigeria',
        servings: '4',
        time: '60 min',
        ingredients: [
            '2 cups ofada (local Nigerian) rice',
            '6 green bell peppers',
            '3 scotch bonnet peppers',
            '1 onion',
            '1.5 cups bleached palm oil',
            '300g assorted meat',
            '2 seasoning cubes',
            'Locust beans (iru)',
            'Crayfish',
        ],
        instructions:
            'Cook and wash ofada rice until done. Blend green peppers, scotch bonnet, onion roughly. Bleach palm oil until smoking, cool slightly, fry locust beans. Add blended peppers and fry 20–25 min. Add cooked meat, crayfish, seasoning. Serve wrapped in banana leaf.',
        youtube: '',
    },
    {
        name: 'Akara (Bean Fritters)',
        tags: ['akara', 'bean fritters', 'fried beans', 'nigerian breakfast'],
        origin: 'Nigeria',
        servings: '4',
        time: '30 min',
        ingredients: [
            '2 cups black-eyed beans (peeled)',
            '1 small onion',
            '1–2 scotch bonnet peppers',
            'Salt to taste',
            'Oil for deep frying',
        ],
        instructions:
            'Blend peeled beans with onion and pepper, adding as little water as possible. Add salt. Whisk vigorously for 2 min to incorporate air. Heat oil to 180°C. Drop spoonfuls into oil and fry until golden brown, 3–4 min per side.',
        youtube: '',
    },
    {
        name: 'Ogbono Soup',
        tags: ['ogbono', 'draw soup', 'nigerian', 'wild mango'],
        origin: 'Nigeria',
        servings: '4–6',
        time: '50 min',
        ingredients: [
            '1 cup ground ogbono seeds',
            '500g assorted meat',
            '1 cup palm oil',
            '2 seasoning cubes',
            'Stockfish & dried prawns',
            'Crayfish',
            'Ugu or spinach leaves',
            'Salt & pepper to taste',
        ],
        instructions:
            'Cook meat with seasoning until tender. Heat palm oil, add ground ogbono and stir until fragrant. Add meat stock gradually, stirring. Add meat, fish, crayfish, and seasoning. Simmer 20 min until thick and stretchy. Add chopped vegetables last 5 min.',
        youtube: '',
    },
    {
        name: 'Efo Riro',
        tags: ['efo riro', 'vegetable soup', 'yoruba', 'spinach', 'nigerian'],
        origin: 'Yoruba, Nigeria',
        servings: '4–6',
        time: '45 min',
        ingredients: [
            '2 bunches spinach or efo tete (African spinach)',
            '3 red bell peppers',
            '2 scotch bonnet peppers',
            '1 onion',
            '1 cup palm oil',
            '300g assorted meat',
            'Stockfish & dried fish',
            'Locust beans (iru)',
            '2 seasoning cubes',
            'Crayfish',
        ],
        instructions:
            'Blend peppers and half the onion. Fry remaining onion and locust beans in palm oil. Add blended pepper and cook 15 min until oil floats. Add meat, fish, crayfish, and seasoning. Cook 10 min. Add chopped spinach, stir and cook 5 min. Do not overcook.',
        youtube: '',
    },
    {
        name: 'Peppered Gizzard',
        tags: ['peppered gizzard', 'gizzard', 'small chops', 'nigerian snack'],
        origin: 'Nigeria',
        servings: '4',
        time: '40 min',
        ingredients: [
            '500g chicken gizzards',
            '2 habanero peppers',
            '1 onion',
            '1 tsp ginger',
            '1 tsp garlic',
            '2 seasoning cubes',
            '2 tbsp vegetable oil',
            'Salt to taste',
        ],
        instructions:
            'Wash and season gizzards with half the seasoning, ginger, garlic. Cook in little water until tender (25 min). Blend peppers and onion. Fry blended pepper in oil 5 min. Add drained gizzards and fry, tossing, until coated and slightly charred.',
        youtube: '',
    },
    {
        name: 'Nigerian Fried Rice',
        tags: ['fried rice', 'nigerian', 'rice', 'party food'],
        origin: 'Nigeria',
        servings: '4–6',
        time: '45 min',
        ingredients: [
            '2 cups parboiled long grain rice',
            '1 cup mixed vegetables (carrots, peas, green beans)',
            '200g liver or chicken (diced)',
            '2 eggs',
            '3 tbsp vegetable oil',
            '2 seasoning cubes',
            '1 tsp curry powder',
            '1 tsp thyme',
            '1 onion',
            'Salt to taste',
        ],
        instructions:
            'Parboil rice in seasoned chicken stock until 70% cooked. Drain. Fry diced meat until cooked. Scramble eggs separately. Stir-fry vegetables in oil. Add rice, meat, eggs, curry powder, and seasoning. Fry everything together on high heat, stirring until fragrant and separate.',
        youtube: '',
    },
    {
        name: 'Pepper Soup',
        tags: ['pepper soup', 'catfish pepper soup', 'nigerian', 'spicy', 'point and kill'],
        origin: 'Nigeria',
        servings: '4',
        time: '35 min',
        ingredients: [
            '1 whole catfish (or goat meat/chicken)',
            '2 tbsp pepper soup spice mix',
            '1 scotch bonnet pepper',
            '1 onion',
            '2 seasoning cubes',
            'Utazi leaves',
            'Scent leaves (efirin)',
            'Salt to taste',
        ],
        instructions:
            'Clean fish/meat. Place in pot with onion, seasoning, pepper soup spice, and scotch bonnet. Add water just to cover. Cook until done (20 min for fish, 35 min for meat). Add salt and herbs. Serve piping hot.',
        youtube: '',
    },
    {
        name: 'Banga Soup (Ofe Akwu)',
        tags: ['banga', 'palm nut soup', 'ofe akwu', 'delta soup', 'nigerian'],
        origin: 'Delta / Igbo, Nigeria',
        servings: '4–6',
        time: '60 min',
        ingredients: [
            '2 cups palm fruit extract (or canned)',
            '500g assorted meat',
            '2 seasoning cubes',
            'Stockfish',
            '1 tbsp banga spice (atama leaves)',
            'Crayfish',
            'Salt to taste',
        ],
        instructions:
            'Cook meat until tender. Add palm fruit extract and cook 20 min until it thickens. Add meat, stockfish, crayfish, and banga spice. Simmer 15 min. Adjust seasoning. Serve with starch, eba, or pounded yam.',
        youtube: '',
    },
    {
        name: 'Chin Chin',
        tags: ['chin chin', 'snack', 'fried dough', 'nigerian snack'],
        origin: 'Nigeria',
        servings: '8',
        time: '60 min',
        ingredients: [
            '3 cups flour',
            '3 tbsp sugar',
            '1/4 tsp salt',
            '1/4 tsp nutmeg',
            '2 eggs',
            '3 tbsp butter',
            '1/2 cup milk',
            'Oil for deep frying',
        ],
        instructions:
            'Mix dry ingredients. Add butter and rub to breadcrumb texture. Beat eggs with milk and add to form a stiff dough. Rest 10 min. Roll thin and cut into strips or shapes. Deep fry in hot oil until golden brown. Drain and cool.',
        youtube: '',
    },
    {
        name: 'Eba (Garri Swallow)',
        tags: ['eba', 'garri', 'swallow', 'fufu', 'cassava'],
        origin: 'Nigeria',
        servings: '2',
        time: '5 min',
        ingredients: [
            '1 cup garri (cassava flakes)',
            '1.5 cups boiling water',
        ],
        instructions:
            'Bring water to a rolling boil. Pour garri into the water, stir vigorously with a wooden spoon, folding until smooth and firm with no lumps. Mould into balls. Serve immediately with any Nigerian soup.',
        youtube: '',
    },
];

/**
 * Search the local recipe database.
 * @param {string} query
 * @returns {object|null} matching recipe or null
 */
function searchLocalRecipe(query) {
    const q = query.toLowerCase().trim();
    // Exact name match first
    const exact = RECIPES.find(r => r.name.toLowerCase() === q);
    if (exact) return exact;
    // Tag / partial name match
    const partial = RECIPES.find(r =>
        r.name.toLowerCase().includes(q) ||
        r.tags.some(t => t.includes(q) || q.includes(t))
    );
    return partial || null;
}

module.exports = { searchLocalRecipe, RECIPES };
