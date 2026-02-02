/**
 * Seed Dummy Data Script
 *
 * Inserts seed singles into the database with a "system" matchmaker ID
 * so they appear as singles from OTHER matchmakers for testing.
 *
 * Run with: bun run scripts/seed-dummy-data.ts
 */

import { createClient } from '@supabase/supabase-js'

interface SeedPerson {
	name: string
	age: number
	location: string
	gender: string
	preferences: Record<string, unknown>
	personality: Record<string, unknown>
	notes: string
}

const seedPeople: SeedPerson[] = [
	{
		name: 'Adaeze Okonkwo',
		age: 32,
		location: 'Houston, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 30, max: 40 },
			heightPreference: '5\'10" or taller',
			fitnessPreference: 'athletic or fit',
			ethnicityPreference: 'Igbo preferred',
			faithLevel: 'strong Christian faith required',
		},
		personality: {
			traits: ['ambitious', 'family-oriented', 'outgoing'],
			interests: ['church activities', 'cooking Nigerian food', 'traveling'],
		},
		notes: `MATCHMAKER: Her mother (Mrs. Okonkwo)
WHY SINGLE: Focused on nursing career, now ready to settle down.
RELATIONSHIP HISTORY: One serious relationship (3 years) that ended.
PHYSICAL: 5'6", Athletic, works out regularly
PREFERENCES: Tall, fit men (5'10"+), must be active in church, Igbo preferred
DEAL BREAKERS: No smokers, no heavy drinkers, must want children`,
	},
	{
		name: 'Jasmine Williams',
		age: 45,
		location: 'Dallas, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 40, max: 55 },
			heightPreference: '6\'0" or taller',
			fitnessPreference: 'athletic required',
			mustNeverMarried: true,
			mustNotHaveKids: true,
		},
		personality: {
			traits: ['confident', 'successful', 'particular'],
			interests: ['fine dining', 'travel', 'spa days'],
		},
		notes: `MATCHMAKER: Best friend (Keisha)
WHY SINGLE: Very high standards. "Hasn't found the one."
RELATIONSHIP HISTORY: Never had a long-term relationship. Dated casually.
PHYSICAL: 5'4", Plus-size, stylish dresser
PREFERENCES: MUST be 6'+, athletic, never married, no kids
EXPECTATIONS ASSESSMENT: MAJOR MISMATCH - Plus-size but wants athletic. 45 but wants never-married with no kids.
RED FLAGS: Never had LTR at 45, extremely rigid requirements`,
	},
	{
		name: 'Marcus Johnson',
		age: 35,
		location: 'Houston, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 27, max: 35 },
			heightPreference: 'any',
			fitnessPreference: 'takes care of herself',
			faithLevel: 'Christian preferred',
		},
		personality: {
			traits: ['hardworking', 'loyal', 'family-oriented'],
			interests: ['sports', 'grilling', 'church'],
		},
		notes: `MATCHMAKER: His sister (Tanya)
WHY SINGLE: Works a lot. Hasn't prioritized dating.
RELATIONSHIP HISTORY: One 5-year relationship in his 20s. Amicable end.
PHYSICAL: 6'1", Athletic build, gym 4x/week
PREFERENCES: Woman who takes care of herself, Christian values, wants family
DEAL BREAKERS: No smokers, must want children
EXPECTATIONS ASSESSMENT: Realistic. Good catch - stable, fit, family-oriented.`,
	},
	{
		name: 'Chidinma Eze',
		age: 29,
		location: 'Austin, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 28, max: 38 },
			heightPreference: '5\'9" or taller',
			ethnicityPreference: 'Nigerian preferred, open to others',
			faithLevel: 'Christian required',
		},
		personality: {
			traits: ['warm', 'nurturing', 'ambitious'],
			interests: ['tech career', 'cooking', 'volunteering'],
		},
		notes: `MATCHMAKER: Her aunt
WHY SINGLE: New to Austin for tech job. Small social circle.
RELATIONSHIP HISTORY: One relationship (2 years) ended when she moved.
PHYSICAL: 5'5", Slim, natural hair, classic style
PREFERENCES: Nigerian preferred, Christian, professional career
DEAL BREAKERS: Must want marriage, no players
EXPECTATIONS ASSESSMENT: Realistic and flexible. Great candidate.`,
	},
	{
		name: 'David Okafor',
		age: 38,
		location: 'Houston, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 28, max: 36 },
			heightPreference: 'any',
			ethnicityPreference: 'Igbo strongly preferred',
			faithLevel: 'Catholic required',
		},
		personality: {
			traits: ['traditional', 'successful', 'reserved'],
			interests: ['business', 'community events', 'family gatherings'],
		},
		notes: `MATCHMAKER: His mother
WHY SINGLE: Very traditional. Wants an Igbo Catholic woman specifically.
RELATIONSHIP HISTORY: Few short relationships. Parents disapproved of non-Igbo girlfriends.
PHYSICAL: 5'11", Average build, professional appearance
PREFERENCES: MUST be Igbo, MUST be Catholic, traditional values
DEAL BREAKERS: Non-negotiable on Igbo and Catholic
EXPECTATIONS ASSESSMENT: Limiting himself significantly but these are genuine values, not superficial.`,
	},
	{
		name: 'Tiffany Brooks',
		age: 34,
		location: 'San Antonio, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 32, max: 45 },
			heightPreference: 'taller than her (5\'7"+)',
			fitnessPreference: 'active lifestyle',
		},
		personality: {
			traits: ['outgoing', 'independent', 'fun-loving'],
			interests: ['fitness', 'brunch', 'concerts'],
		},
		notes: `MATCHMAKER: Her cousin
WHY SINGLE: Focused on career in her 20s. Ready now.
RELATIONSHIP HISTORY: Several relationships, longest was 2 years.
PHYSICAL: 5'6", Fit, works out regularly, trendy style
PREFERENCES: Active man, good sense of humor, financially stable
DEAL BREAKERS: No couch potatoes, must have ambition
EXPECTATIONS ASSESSMENT: Realistic. Looking for an equal partner.`,
	},
	{
		name: 'Emmanuel Adeyemi',
		age: 42,
		location: 'Dallas, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 30, max: 40 },
			heightPreference: 'any',
			ethnicityPreference: 'Yoruba preferred, open to Nigerian',
		},
		personality: {
			traits: ['calm', 'wise', 'generous'],
			interests: ['mentoring', 'real estate', 'community'],
		},
		notes: `MATCHMAKER: Church pastor
WHY SINGLE: Divorced 5 years ago. Took time to heal and grow.
RELATIONSHIP HISTORY: Married 8 years, divorced. No children from marriage.
PHYSICAL: 6'0", Average build, distinguished appearance
PREFERENCES: Yoruba or Nigerian woman, mature, ready for marriage
DEAL BREAKERS: Must be serious about marriage
EXPECTATIONS ASSESSMENT: Realistic. Learned from past. Ready for right person.`,
	},
	{
		name: 'Ngozi Nnamdi',
		age: 31,
		location: 'Houston, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 32, max: 42 },
			heightPreference: '6\'2" or taller REQUIRED',
			fitnessPreference: 'very fit required',
			incomeExpectation: '$150k+ required',
		},
		personality: {
			traits: ['ambitious', 'particular', 'accomplished'],
			interests: ['luxury travel', 'fine dining', 'fashion'],
		},
		notes: `MATCHMAKER: Her older sister
WHY SINGLE: "Standards are high but she knows what she wants"
RELATIONSHIP HISTORY: Dated several men, none "met her standards"
PHYSICAL: 5'8", Slim, very attractive, designer style
PREFERENCES: MUST be 6'2"+, MUST be very fit, MUST make $150k+
EXPECTATIONS ASSESSMENT: Very high standards. She's attractive but pool is tiny.
RED FLAGS: May be pricing herself out of market. Very rigid on height.`,
	},
	{
		name: 'Kevin Thompson',
		age: 40,
		location: 'Austin, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 30, max: 40 },
			heightPreference: 'any',
			fitnessPreference: 'healthy lifestyle',
		},
		personality: {
			traits: ['creative', 'thoughtful', 'loyal'],
			interests: ['music', 'hiking', 'cooking'],
		},
		notes: `MATCHMAKER: Best friend from college
WHY SINGLE: Introverted. Doesn't meet many women naturally.
RELATIONSHIP HISTORY: One long relationship (6 years), ended mutually.
PHYSICAL: 5'10", Slim-athletic, casual style
PREFERENCES: Kind woman, shared values, wants family eventually
DEAL BREAKERS: No drama, no games
EXPECTATIONS ASSESSMENT: Very realistic. Quality guy who just needs exposure.`,
	},
	{
		name: 'Blessing Obi',
		age: 27,
		location: 'Houston, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 27, max: 35 },
			heightPreference: 'taller than her',
			ethnicityPreference: 'Nigerian preferred',
			faithLevel: 'Christian required',
		},
		personality: {
			traits: ['sweet', 'traditional', 'caring'],
			interests: ['nursing career', 'church choir', 'cooking'],
		},
		notes: `MATCHMAKER: Her mother
WHY SINGLE: Young, focused on establishing career first.
RELATIONSHIP HISTORY: One boyfriend in college (2 years).
PHYSICAL: 5'3", Petite, natural beauty, modest style
PREFERENCES: Christian man, Nigerian preferred, wants family
DEAL BREAKERS: Must respect her values, no pressure for intimacy before marriage
EXPECTATIONS ASSESSMENT: Realistic and grounded. Traditional values but not rigid.`,
	},
]

async function seedDatabase() {
	let supabaseUrl = process.env.SUPABASE_URL
	let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
	let seedMatchmakerId = process.env.SEED_MATCHMAKER_ID

	if (!supabaseUrl || !supabaseServiceKey) {
		console.error('ERROR: Missing environment variables')
		console.error('')
		console.error('Required:')
		console.error('  SUPABASE_URL - Your Supabase project URL')
		console.error('  SUPABASE_SERVICE_ROLE_KEY - Service role key (from Supabase settings)')
		console.error('  SEED_MATCHMAKER_ID - UUID of a user to own the seed data')
		console.error('')
		console.error('To get SEED_MATCHMAKER_ID:')
		console.error('  1. Create a test account in your app (e.g., seed@test.com)')
		console.error('  2. Go to Supabase Dashboard → Authentication → Users')
		console.error('  3. Copy the UUID of that user')
		console.error('')
		console.error('Example:')
		console.error('  SUPABASE_URL=https://xxx.supabase.co \\')
		console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJ... \\')
		console.error('  SEED_MATCHMAKER_ID=12345678-1234-1234-1234-123456789012 \\')
		console.error('  bun run scripts/seed-dummy-data.ts')
		process.exit(1)
	}

	if (!seedMatchmakerId) {
		console.error('ERROR: SEED_MATCHMAKER_ID is required')
		console.error('')
		console.error('To get a matchmaker ID for seeding:')
		console.error('  1. Create a second account in your app (different from your main account)')
		console.error('  2. Go to Supabase Dashboard → Authentication → Users')
		console.error('  3. Copy the UUID of that account')
		console.error('  4. Pass it as SEED_MATCHMAKER_ID')
		process.exit(1)
	}

	let supabase = createClient(supabaseUrl, supabaseServiceKey)

	console.log(`Using matchmaker ID: ${seedMatchmakerId}`)
	console.log('')

	// Verify the matchmaker exists
	let { data: matchmaker, error: matchmakerError } = await supabase
		.from('matchmakers')
		.select('id, name')
		.eq('id', seedMatchmakerId)
		.single()

	if (matchmakerError || !matchmaker) {
		console.error(`ERROR: Matchmaker not found with ID: ${seedMatchmakerId}`)
		console.error('Make sure the user has signed up through the app at least once.')
		process.exit(1)
	}

	console.log(`Found matchmaker: ${matchmaker.name}`)
	console.log(`Seeding ${seedPeople.length} people...`)
	console.log('')

	let created = 0
	let errors = 0

	for (let person of seedPeople) {
		try {
			let { data, error } = await supabase
				.from('people')
				.insert({
					matchmaker_id: seedMatchmakerId,
					name: person.name,
					age: person.age,
					location: person.location,
					gender: person.gender,
					preferences: person.preferences,
					personality: person.personality,
					notes: person.notes,
					active: true,
				})
				.select()
				.single()

			if (error) throw error

			console.log(`✓ ${person.name} (${person.age}, ${person.gender}, ${person.location})`)
			created++
		} catch (error) {
			console.error(`✗ ${person.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
			errors++
		}
	}

	console.log('')
	console.log('--- Seed Complete ---')
	console.log(`Created: ${created}`)
	console.log(`Errors: ${errors}`)
}

seedDatabase().catch(error => {
	console.error('Fatal error:', error)
	process.exit(1)
})
