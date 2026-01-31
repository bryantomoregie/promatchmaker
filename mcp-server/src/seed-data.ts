/**
 * Seed Data Script for Pro Matchmaker
 *
 * Creates 20 diverse personas (10 male, 10 female) with realistic profiles
 * for testing the matching functionality.
 *
 * Run with: bun run src/seed-data.ts
 */

import { loadConfig } from './config.js'
import { ApiClient } from './api.js'

interface SeedPerson {
	name: string
	age: number
	location: string
	gender: string
	preferences: {
		ageRange?: { min: number; max: number }
		heightPreference?: string
		fitnessPreference?: string
		ethnicityPreference?: string
		faithLevel?: string
		incomeExpectation?: string
		mustNotHaveKids?: boolean
		mustNeverMarried?: boolean
		tribePreference?: string
	}
	personality: {
		traits: string[]
		interests: string[]
		communicationStyle?: string
	}
	notes: string
}

// Female profiles (10)
const femaleProfiles: SeedPerson[] = [
	{
		name: 'Adaeze Okonkwo',
		age: 32,
		location: 'Houston, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 30, max: 40 },
			heightPreference: '5\'10" or taller',
			fitnessPreference: 'athletic or fit',
			ethnicityPreference: 'Igbo preferred, open to other Nigerian tribes',
			faithLevel: 'strong Christian faith required',
		},
		personality: {
			traits: ['ambitious', 'family-oriented', 'outgoing'],
			interests: ['church activities', 'cooking Nigerian food', 'traveling'],
			communicationStyle: 'direct and warm',
		},
		notes: `MATCHMAKER: Her mother (Mrs. Okonkwo)
HOW THEY HEARD: Church connection in Houston

WHY SINGLE (per matchmaker): Focused on nursing career, now ready to settle down. Very selective about finding an Igbo man.

RELATIONSHIP HISTORY: Had one serious relationship (3 years) that ended because he wasn't ready for marriage.

PHYSICAL DESCRIPTION:
- Height: 5'6"
- Build: Athletic, works out regularly
- Fitness level: Very active, runs 5Ks
- Style: Professional, well-dressed
- Social media: Private Instagram

PREFERENCES STATED:
- Physical: Prefers tall, fit men (5'10"+)
- Faith: Must be active in church
- Career/Income: Professional career expected
- Age range: 30-40
- Ethnicity: Strongly prefers Igbo man

DEAL BREAKERS (non-standard):
- No smokers
- No heavy drinkers
- Must want children

EXPECTATIONS ASSESSMENT: Realistic - she's attractive, professional, and has reasonable standards

RED FLAGS DETECTED: None significant

FLEXIBILITY DISCUSSIONS: Open to Yoruba or other Nigerian tribes if he's a good match otherwise`,
	},
	{
		name: 'Michelle Thompson',
		age: 28,
		location: 'Dallas, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 27, max: 38 },
			heightPreference: '5\'8" or taller',
			fitnessPreference: 'average to athletic',
			ethnicityPreference: 'open to all',
			faithLevel: 'Christian, regular church attendance',
		},
		personality: {
			traits: ['creative', 'empathetic', 'social'],
			interests: ['marketing', 'art galleries', 'brunches with friends'],
			communicationStyle: 'warm and engaging',
		},
		notes: `MATCHMAKER: Best friend (Keisha)
HOW THEY HEARD: Instagram ad

WHY SINGLE (per matchmaker): She's been too focused on building her career. Also tends to attract the wrong type of men.

RELATIONSHIP HISTORY: Several short relationships, nothing over a year. Matchmaker says she picks "flashy guys who aren't serious."

PHYSICAL DESCRIPTION:
- Height: 5'5"
- Build: Slim
- Fitness level: Does yoga occasionally
- Style: Trendy, fashionable
- Social media: @michelle.creates

PREFERENCES STATED:
- Physical: Tall, well-groomed
- Faith: Christian background
- Career/Income: Stable career, doesn't need to be rich
- Age range: 27-38
- Ethnicity: Open

DEAL BREAKERS (non-standard):
- No long-distance
- Must have own place

EXPECTATIONS ASSESSMENT: Realistic and flexible

RED FLAGS DETECTED: Pattern of picking wrong partners - may need guidance on recognizing good matches

FLEXIBILITY DISCUSSIONS: Very open, just wants someone genuine`,
	},
	{
		name: 'Chidinma Eze',
		age: 38,
		location: 'Austin, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 35, max: 48 },
			heightPreference: 'not important',
			fitnessPreference: 'average is fine',
			ethnicityPreference: 'Nigerian or African American',
			faithLevel: 'Christian required',
		},
		personality: {
			traits: ['intelligent', 'reserved', 'nurturing'],
			interests: ['law', 'reading', 'cooking'],
			communicationStyle: 'thoughtful, takes time to open up',
		},
		notes: `MATCHMAKER: Sister (Adanna)
HOW THEY HEARD: Word of mouth from cousin

WHY SINGLE (per matchmaker): Divorced after 5 years. Ex-husband was unfaithful. She took time to heal.

RELATIONSHIP HISTORY: Married at 29, divorced at 34. Has one daughter (age 8).

PHYSICAL DESCRIPTION:
- Height: 5'7"
- Build: Average
- Fitness level: Not very active
- Style: Conservative, professional
- Social media: No public profiles

PREFERENCES STATED:
- Physical: Not picky about looks
- Faith: Must be Christian, preferably Catholic
- Career/Income: Established career, stable
- Age range: 35-48
- Ethnicity: Nigerian or African American

DEAL BREAKERS (non-standard):
- Must accept her daughter
- Must not have more than 2 kids of his own

EXPECTATIONS ASSESSMENT: Very realistic, knows her situation

RED FLAGS DETECTED: None - seems emotionally healthy post-divorce

FLEXIBILITY DISCUSSIONS: Open to widowers or divorced men`,
	},
	{
		name: 'Jasmine Williams',
		age: 45,
		location: 'Houston, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 40, max: 55 },
			heightPreference: '6 feet or taller',
			fitnessPreference: 'very fit, athletic build required',
			ethnicityPreference: 'African American preferred',
			faithLevel: 'strong faith required',
			mustNeverMarried: true,
			mustNotHaveKids: true,
		},
		personality: {
			traits: ['independent', 'opinionated', 'generous'],
			interests: ['teaching', 'church choir', 'traveling'],
			communicationStyle: 'very direct',
		},
		notes: `MATCHMAKER: Church friend (Pastor's wife)
HOW THEY HEARD: Pastor recommendation

WHY SINGLE (per matchmaker): "Very particular about what she wants. Has turned down many good men."

RELATIONSHIP HISTORY: Never had a long-term relationship over 1 year. Matchmaker admits she's "picky."

PHYSICAL DESCRIPTION:
- Height: 5'4"
- Build: Plus-size
- Fitness level: Sedentary, acknowledges weight issue
- Style: Well-dressed, always presentable
- Social media: Facebook only

PREFERENCES STATED:
- Physical: MUST be 6'+ and very fit/athletic
- Faith: Very involved in church
- Career/Income: High earner expected
- Age range: 40-55
- Ethnicity: African American, no Africans

DEAL BREAKERS (non-standard):
- NO divorced men
- NO men with children
- Must own a home

EXPECTATIONS ASSESSMENT: SIGNIFICANT MISMATCH - Plus-size but requires athletic partner. 45 with no relationship history wanting never-married man with no kids.

RED FLAGS DETECTED:
- Never had LTR at 45 (concerning)
- Very rigid requirements that don't match what she brings
- Matchmaker expressed frustration

FLEXIBILITY DISCUSSIONS: Attempted to discuss. She believes "God will send the right one." Difficult case.

MY ADVANTAGE OVER PREVIOUS ATTEMPTS: Honest conversation about market realities needed. Previous matchmakers may have been too polite.`,
	},
	{
		name: 'Ngozi Adeleke',
		age: 29,
		location: 'Dallas, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 28, max: 36 },
			heightPreference: '6\'2" or taller (non-negotiable)',
			fitnessPreference: 'athletic',
			ethnicityPreference: 'Nigerian only, Yoruba preferred',
			faithLevel: 'Christian',
			incomeExpectation: '$150k+ salary',
		},
		personality: {
			traits: ['driven', 'perfectionist', 'stylish'],
			interests: ['software engineering', 'fashion', 'fine dining'],
			communicationStyle: 'precise, analytical',
		},
		notes: `MATCHMAKER: Mother (Mrs. Adeleke)
HOW THEY HEARD: Nigerian community grapevine

WHY SINGLE (per matchmaker): "Her standards are very high. She's successful so she expects the same."

RELATIONSHIP HISTORY: Dated one guy for 2 years in college. Since then, nothing serious - says "the men in Dallas aren't up to par."

PHYSICAL DESCRIPTION:
- Height: 5'8"
- Build: Slim, model-like
- Fitness level: Active, does Pilates
- Style: High fashion, designer clothes
- Social media: @ngozi.style (fashion influencer)

PREFERENCES STATED:
- Physical: MUST be 6'2"+, athletic, well-dressed
- Faith: Christian but doesn't need to be super devout
- Career/Income: Must earn $150k+ minimum
- Age range: 28-36 only
- Ethnicity: Nigerian only, ideally Yoruba

DEAL BREAKERS (non-standard):
- No earrings on men
- No visible tattoos
- Must have graduate degree
- Must not live with parents

EXPECTATIONS ASSESSMENT: CHALLENGING - Very attractive and successful, but 6'2"+ at $150k+ in her age range is extremely limited pool. Height requirement alone eliminates 95% of men.

RED FLAGS DETECTED:
- Very long list of requirements
- Pattern of dismissing men quickly

FLEXIBILITY DISCUSSIONS: Mother says she's been trying to get her to be more flexible on height. Daughter resistant.

MY ADVANTAGE OVER PREVIOUS ATTEMPTS: Need to have market reality conversation about height statistics.`,
	},
	{
		name: 'Brittany Jackson',
		age: 35,
		location: 'San Antonio, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 32, max: 42 },
			heightPreference: '5\'10" or taller',
			fitnessPreference: 'very fit - gym regularly',
			ethnicityPreference: 'open',
			faithLevel: 'Christian, active in church',
		},
		personality: {
			traits: ['health-conscious', 'nurturing', 'social'],
			interests: ['nursing', 'CrossFit', 'meal prepping'],
			communicationStyle: 'encouraging and positive',
		},
		notes: `MATCHMAKER: Gym buddy (Tanya)
HOW THEY HEARD: Overheard Tanya talking about it at gym

WHY SINGLE (per matchmaker): "She's amazing but she's very into fitness and can't find a guy who matches her lifestyle."

RELATIONSHIP HISTORY: 3-year relationship ended because he "let himself go" and wouldn't work out with her.

PHYSICAL DESCRIPTION:
- Height: 5'6"
- Build: Very athletic, muscular
- Fitness level: CrossFit 5x/week, competes
- Style: Athletic wear mostly
- Social media: @brittfitlife

PREFERENCES STATED:
- Physical: Must be fit and active - gym is a lifestyle
- Faith: Christian
- Career/Income: Stable job
- Age range: 32-42
- Ethnicity: Open

DEAL BREAKERS (non-standard):
- Must work out regularly (4+ times/week)
- No fast food lifestyle
- Must be open to meal prepping together

EXPECTATIONS ASSESSMENT: REASONABLE - She's extremely fit and wants a fit partner. Fair exchange.

RED FLAGS DETECTED: May be too focused on fitness to the exclusion of other compatibility factors

FLEXIBILITY DISCUSSIONS: Discussed that not all great men are gym rats. She said active is fine, doesn't have to be CrossFit.`,
	},
	{
		name: 'Amara Nwosu',
		age: 42,
		location: 'Houston, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 40, max: 55 },
			heightPreference: 'not important',
			fitnessPreference: 'average is fine',
			ethnicityPreference: 'Nigerian or African',
			faithLevel: 'strong Catholic faith',
		},
		personality: {
			traits: ['resilient', 'business-minded', 'warm'],
			interests: ['import/export business', 'cooking', 'mentoring young women'],
			communicationStyle: 'warm but businesslike',
		},
		notes: `MATCHMAKER: Business partner (Grace)
HOW THEY HEARD: Nigerian business association meeting

WHY SINGLE (per matchmaker): Widowed 4 years ago. Husband died of cancer. Took time to grieve, now ready.

RELATIONSHIP HISTORY: Married for 12 years. Two children (now 15 and 18).

PHYSICAL DESCRIPTION:
- Height: 5'5"
- Build: Average, has gained some weight since husband passed
- Fitness level: Walks occasionally
- Style: Traditional Nigerian attire often
- Social media: Private

PREFERENCES STATED:
- Physical: Not important, character matters more
- Faith: Must be Catholic or willing to convert
- Career/Income: Stable, preferably entrepreneur
- Age range: 40-55
- Ethnicity: Nigerian or African

DEAL BREAKERS (non-standard):
- Must respect her late husband's memory
- Must accept her children
- Cannot be controlling

EXPECTATIONS ASSESSMENT: Very realistic and grounded

RED FLAGS DETECTED: None - emotionally healthy, reasonable expectations

FLEXIBILITY DISCUSSIONS: Open to most things. Just wants a good man who shares her faith.`,
	},
	{
		name: 'Tiffany Brown',
		age: 31,
		location: 'Austin, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 30, max: 40 },
			heightPreference: '5\'9" or taller',
			fitnessPreference: 'average to fit',
			ethnicityPreference: 'open',
			faithLevel: 'Christian',
			mustNotHaveKids: true,
		},
		personality: {
			traits: ['organized', 'introverted', 'loyal'],
			interests: ['accounting', 'reading', 'hiking'],
			communicationStyle: 'quiet but thoughtful',
		},
		notes: `MATCHMAKER: College roommate (Sarah)
HOW THEY HEARD: Sarah's husband knew someone who used the service

WHY SINGLE (per matchmaker): "She doesn't put herself out there. Very introverted. Works from home."

RELATIONSHIP HISTORY: One serious relationship in college (2 years). Since then, occasional dates but nothing sticks.

PHYSICAL DESCRIPTION:
- Height: 5'4"
- Build: Slim
- Fitness level: Hikes on weekends
- Style: Casual, natural
- Social media: LinkedIn only

PREFERENCES STATED:
- Physical: Taller than her, reasonably fit
- Faith: Christian preferred
- Career/Income: Professional career
- Age range: 30-40
- Ethnicity: Open

DEAL BREAKERS (non-standard):
- No men with children (wants to start fresh)
- Must be okay with her introverted nature
- No party guys

EXPECTATIONS ASSESSMENT: Realistic but the no-kids requirement at 31 limits pool

RED FLAGS DETECTED: Very introverted - may need help opening up to matches

FLEXIBILITY DISCUSSIONS: Discussed kids question. She said "maybe if they're older and not full-time custody."`,
	},
	{
		name: 'Chiamaka Obi',
		age: 27,
		location: 'Dallas, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 27, max: 35 },
			heightPreference: '5\'10" or taller',
			fitnessPreference: 'fit',
			ethnicityPreference: 'Nigerian, Igbo only',
			faithLevel: 'Christian, active in church',
		},
		personality: {
			traits: ['ambitious', 'studious', 'reserved initially'],
			interests: ['medicine', 'travel', 'Nigerian movies'],
			communicationStyle: 'professional, opens up over time',
		},
		notes: `MATCHMAKER: Older brother (Chidi)
HOW THEY HEARD: Friend's successful match through the service

WHY SINGLE (per matchmaker): "She's been in medical school forever. Just finished residency. Now she has time."

RELATIONSHIP HISTORY: Dated one guy in undergrad briefly. Nothing since - too busy with school.

PHYSICAL DESCRIPTION:
- Height: 5'7"
- Build: Athletic
- Fitness level: Gym when she has time
- Style: Professional, sometimes casual
- Social media: Private Instagram

PREFERENCES STATED:
- Physical: Tall, fit, well-groomed
- Faith: Christian, churchgoer
- Career/Income: Professional (doctor, lawyer, engineer)
- Age range: 27-35
- Ethnicity: Igbo only (parents' requirement)

DEAL BREAKERS (non-standard):
- Must be Igbo (family pressure)
- Must be educated (graduate degree)
- No smokers

EXPECTATIONS ASSESSMENT: Reasonable given her profile - young, beautiful doctor

RED FLAGS DETECTED:
- Late bloomer in dating - may lack experience
- Tribe requirement is family-driven, not her own preference

FLEXIBILITY DISCUSSIONS: Brother says she personally would date other tribes but parents would "disown her"`,
	},
	{
		name: 'Lauren Davis',
		age: 40,
		location: 'Houston, TX',
		gender: 'female',
		preferences: {
			ageRange: { min: 38, max: 50 },
			heightPreference: '6 feet or taller',
			fitnessPreference: 'fit',
			ethnicityPreference: 'open',
			faithLevel: 'Christian',
			incomeExpectation: '$200k+ salary',
		},
		personality: {
			traits: ['ambitious', 'sophisticated', 'high-maintenance'],
			interests: ['real estate', 'luxury travel', 'wine'],
			communicationStyle: 'confident, knows what she wants',
		},
		notes: `MATCHMAKER: Sorority sister (Vanessa)
HOW THEY HEARD: Saw a success story on social media

WHY SINGLE (per matchmaker): "She's very successful and intimidates men. Also has very high standards."

RELATIONSHIP HISTORY: Several relationships, longest was 2 years. She ended most of them - "they couldn't keep up with her lifestyle."

PHYSICAL DESCRIPTION:
- Height: 5'8"
- Build: Average, could lose a few pounds
- Fitness level: Does personal training sessions
- Style: Designer everything
- Social media: @laurensellsluxury

PREFERENCES STATED:
- Physical: Tall, fit, well-dressed
- Faith: Christian background
- Career/Income: MUST earn $200k+ (she earns $300k)
- Age range: 38-50
- Ethnicity: Open

DEAL BREAKERS (non-standard):
- Must have significant assets (home, investments)
- Must be comfortable with luxury lifestyle
- No "cheap" men

EXPECTATIONS ASSESSMENT: CHALLENGING - Her income requirements eliminate most men. At 40, the pool of high-earners who are single and interested is small.

RED FLAGS DETECTED:
- Pattern of ending relationships
- Very materialistic focus
- May value wealth over character

FLEXIBILITY DISCUSSIONS: Tried to discuss. She said "I'm not lowering my standards. I worked hard for what I have."

MY ADVANTAGE OVER PREVIOUS ATTEMPTS: Honest conversation about what her requirements mean for the dating pool.`,
	},
]

// Male profiles (10)
const maleProfiles: SeedPerson[] = [
	{
		name: 'Chukwuemeka Adeyemi',
		age: 34,
		location: 'Houston, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 25, max: 32 },
			heightPreference: 'not important',
			fitnessPreference: 'slim to average',
			ethnicityPreference: 'Yoruba preferred',
			faithLevel: 'Christian required',
		},
		personality: {
			traits: ['ambitious', 'traditional', 'generous'],
			interests: ['oil & gas industry', 'soccer', 'investing'],
			communicationStyle: 'confident, sometimes reserved',
		},
		notes: `MATCHMAKER: Mother (Mrs. Adeyemi)
HOW THEY HEARD: Nigerian community in Houston

WHY SINGLE (per matchmaker): "He works too much. Travels for work constantly. Hard to maintain relationship."

RELATIONSHIP HISTORY: Had a fiancée 3 years ago. She broke it off because of his travel schedule.

PHYSICAL DESCRIPTION:
- Height: 6'1"
- Build: Athletic
- Fitness level: Plays soccer weekly
- Style: Professional, sharp dresser
- Social media: LinkedIn only

PREFERENCES STATED:
- Physical: Attractive, slim to average build
- Faith: Christian, family-oriented
- Career/Income: Doesn't matter, he provides
- Age range: 25-32 (wants younger to start family)
- Ethnicity: Yoruba strongly preferred

DEAL BREAKERS (non-standard):
- Must be willing to relocate for his work
- Must want children (at least 3)
- No women who party too much

EXPECTATIONS ASSESSMENT: Reasonable for his profile - high earner, attractive, good family

RED FLAGS DETECTED: The travel issue is real and hasn't been resolved

FLEXIBILITY DISCUSSIONS: Open to other tribes if she's exceptional. Not flexible on the kids/family question.`,
	},
	{
		name: 'Marcus Johnson',
		age: 30,
		location: 'Dallas, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 25, max: 32 },
			heightPreference: 'shorter than him',
			fitnessPreference: 'average to fit',
			ethnicityPreference: 'open to all',
			faithLevel: 'Christian preferred',
		},
		personality: {
			traits: ['easy-going', 'reliable', 'funny'],
			interests: ['IT', 'video games', 'basketball'],
			communicationStyle: 'laid-back, good listener',
		},
		notes: `MATCHMAKER: Older sister (Keisha)
HOW THEY HEARD: Keisha's coworker used the service

WHY SINGLE (per matchmaker): "He's a great guy but he's shy. Doesn't approach women. Needs someone to introduce him."

RELATIONSHIP HISTORY: One girlfriend in college for 1 year. Since then, nothing serious despite being "a catch."

PHYSICAL DESCRIPTION:
- Height: 5'11"
- Build: Average
- Fitness level: Plays basketball recreationally
- Style: Casual, clean
- Social media: Gaming profiles only

PREFERENCES STATED:
- Physical: Attractive, takes care of herself
- Faith: Christian background
- Career/Income: Has a job, stable
- Age range: 25-32
- Ethnicity: Open

DEAL BREAKERS (non-standard):
- Must not be controlling
- Must be patient with his introverted nature
- No drama queens

EXPECTATIONS ASSESSMENT: Very realistic and flexible

RED FLAGS DETECTED: Shyness may make initial conversations difficult - matchmaker should prep the woman

FLEXIBILITY DISCUSSIONS: Open to almost everything. Just wants someone kind.`,
	},
	{
		name: 'Obiora Nnamdi',
		age: 41,
		location: 'Austin, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 30, max: 40 },
			heightPreference: 'not important',
			fitnessPreference: 'any',
			ethnicityPreference: 'Nigerian or African American',
			faithLevel: 'Christian',
		},
		personality: {
			traits: ['intellectual', 'calm', 'caring'],
			interests: ['medicine', 'reading', 'mentoring'],
			communicationStyle: 'thoughtful, patient',
		},
		notes: `MATCHMAKER: Best friend from med school (Emeka)
HOW THEY HEARD: Emeka's wife found the service

WHY SINGLE (per matchmaker): Divorced 3 years ago. No children from marriage. Wife wanted different lifestyle.

RELATIONSHIP HISTORY: Married for 7 years. Amicable divorce. He's been cautious about dating since.

PHYSICAL DESCRIPTION:
- Height: 5'9"
- Build: Slim
- Fitness level: Walks, does yoga
- Style: Professional casual
- Social media: None

PREFERENCES STATED:
- Physical: Not his focus
- Faith: Christian or willing to explore
- Career/Income: Educated, has ambition
- Age range: 30-40
- Ethnicity: Nigerian or African American

DEAL BREAKERS (non-standard):
- Must want a calm, peaceful home
- No high drama personalities
- Must appreciate his profession's demands

EXPECTATIONS ASSESSMENT: Very realistic, emotionally mature

RED FLAGS DETECTED: None - seems well-adjusted post-divorce

FLEXIBILITY DISCUSSIONS: Very flexible on most things. Values character over specifics.`,
	},
	{
		name: 'DeShawn Williams',
		age: 29,
		location: 'Houston, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 24, max: 30 },
			heightPreference: '5\'4" to 5\'8"',
			fitnessPreference: 'very fit required',
			ethnicityPreference: 'open',
			faithLevel: 'believes in God',
		},
		personality: {
			traits: ['energetic', 'disciplined', 'social'],
			interests: ['personal training', 'fitness competitions', 'nutrition'],
			communicationStyle: 'motivating, high-energy',
		},
		notes: `MATCHMAKER: Business partner (Jamal)
HOW THEY HEARD: Gym client mentioned it

WHY SINGLE (per matchmaker): "He's very into fitness and can't find a woman who matches his lifestyle."

RELATIONSHIP HISTORY: Few short relationships. All ended because "they couldn't keep up with his fitness routine."

PHYSICAL DESCRIPTION:
- Height: 6'2"
- Build: Very muscular, bodybuilder physique
- Fitness level: Trains 2x/day, competitor
- Style: Athletic wear 90% of the time
- Social media: @deshawnfitness (50k followers)

PREFERENCES STATED:
- Physical: MUST be fit - visible abs preferred
- Faith: Believes in God, not super religious
- Career/Income: Any job is fine
- Age range: 24-30
- Ethnicity: Open

DEAL BREAKERS (non-standard):
- Must work out regularly
- Must eat clean
- No smoking, no excessive drinking
- Must support his fitness goals

EXPECTATIONS ASSESSMENT: Fair trade - he's extremely fit and wants the same

RED FLAGS DETECTED: Very narrow focus on fitness may miss good matches

FLEXIBILITY DISCUSSIONS: Says "fit" not necessarily bodybuilder. Active and healthy is good enough.`,
	},
	{
		name: 'Tochukwu Ibe',
		age: 36,
		location: 'Dallas, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 25, max: 34 },
			heightPreference: 'shorter than 5\'7"',
			fitnessPreference: 'slim only',
			ethnicityPreference: 'Igbo only',
			faithLevel: 'strong Christian',
			mustNeverMarried: true,
			mustNotHaveKids: true,
		},
		personality: {
			traits: ['analytical', 'reserved', 'stubborn'],
			interests: ['accounting', 'chess', 'Igbo cultural events'],
			communicationStyle: 'formal, takes time to warm up',
		},
		notes: `MATCHMAKER: Mother (Mrs. Ibe)
HOW THEY HEARD: Igbo community association

WHY SINGLE (per matchmaker): Mother says "He's too picky. I've introduced him to many good girls." He rejects everyone.

RELATIONSHIP HISTORY: NEVER had a long-term relationship. Mother is concerned. He says "the right one hasn't come."

PHYSICAL DESCRIPTION:
- Height: 5'7"
- Build: Average, slight belly
- Fitness level: Sedentary
- Style: Conservative
- Social media: None

PREFERENCES STATED:
- Physical: MUST be slim (no curves), short, light-skinned preferred
- Faith: Strong Igbo Catholic
- Career/Income: Educated but not too ambitious
- Age range: 25-34 (wants younger)
- Ethnicity: Igbo ONLY, specific villages preferred

DEAL BREAKERS (non-standard):
- No women taller than him
- No women who've had children
- No divorced women
- Must be from "good family" (specific Igbo definition)

EXPECTATIONS ASSESSMENT: MAJOR MISMATCH - 36, never had LTR, average looks, sedentary lifestyle but wants slim, young, never-married Igbo woman from specific background. Very concerning pattern.

RED FLAGS DETECTED:
- Never had LTR at 36 (major concern)
- Mother is doing matchmaking (he may not be motivated)
- Extremely rigid and specific requirements
- Light-skin preference concerning

FLEXIBILITY DISCUSSIONS: Mother wants him to be flexible. He refuses. Difficult case.

MY ADVANTAGE OVER PREVIOUS ATTEMPTS: Need to assess if HE actually wants to marry or if this is mother's agenda.`,
	},
	{
		name: 'Kevin Mitchell',
		age: 44,
		location: 'San Antonio, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 35, max: 48 },
			heightPreference: 'not important',
			fitnessPreference: 'any',
			ethnicityPreference: 'open',
			faithLevel: 'strong Christian faith required',
		},
		personality: {
			traits: ['spiritual', 'compassionate', 'patient'],
			interests: ['ministry', 'community service', 'family'],
			communicationStyle: 'warm, pastoral',
		},
		notes: `MATCHMAKER: Church elder (Deacon Brown)
HOW THEY HEARD: Church network

WHY SINGLE (per matchmaker): Widowed 3 years ago. Wife passed from illness. He's ready to love again.

RELATIONSHIP HISTORY: Married for 15 years. Two children (ages 12 and 14). Beautiful marriage by all accounts.

PHYSICAL DESCRIPTION:
- Height: 5'10"
- Build: Average, dad bod
- Fitness level: Not active
- Style: Pastoral, clean
- Social media: Church Facebook page only

PREFERENCES STATED:
- Physical: Not important
- Faith: MUST be deeply committed Christian
- Career/Income: Doesn't matter
- Age range: 35-48
- Ethnicity: Open

DEAL BREAKERS (non-standard):
- Must love children and accept his kids
- Must be involved in church
- Must understand demands of ministry life

EXPECTATIONS ASSESSMENT: Very realistic and grounded

RED FLAGS DETECTED: None - emotionally healthy, knows what matters

FLEXIBILITY DISCUSSIONS: Open to everything except faith requirement. Non-negotiable.`,
	},
	{
		name: 'Emeka Okoro',
		age: 33,
		location: 'Houston, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 26, max: 34 },
			heightPreference: 'shorter than him',
			fitnessPreference: 'slim to average',
			ethnicityPreference: 'Nigerian preferred',
			faithLevel: 'Christian',
		},
		personality: {
			traits: ['charismatic', 'ambitious', 'fun'],
			interests: ['banking', 'networking events', 'travel'],
			communicationStyle: 'charming, smooth talker',
		},
		notes: `MATCHMAKER: Cousin (Chidi)
HOW THEY HEARD: Family pressure

WHY SINGLE (per matchmaker): "He's charming but short. Women overlook him. But he's a great guy."

RELATIONSHIP HISTORY: Several relationships, most ended with women choosing taller men.

PHYSICAL DESCRIPTION:
- Height: 5'8"
- Build: Athletic, works out
- Fitness level: Gym 4x/week
- Style: Sharp, fashion-forward
- Social media: @emeka.okoro

PREFERENCES STATED:
- Physical: Attractive, takes care of herself
- Faith: Christian
- Career/Income: Professional
- Age range: 26-34
- Ethnicity: Nigerian preferred

DEAL BREAKERS (non-standard):
- Must not care about height
- Must be comfortable with his social lifestyle

EXPECTATIONS ASSESSMENT: Realistic but height has been an obstacle

RED FLAGS DETECTED: None - good guy limited by something he can't control

FLEXIBILITY DISCUSSIONS: Very flexible. Just wants someone who sees past his height.`,
	},
	{
		name: 'Jamal Thompson',
		age: 38,
		location: 'Austin, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 28, max: 36 },
			heightPreference: '5\'4" to 5\'8"',
			fitnessPreference: 'slim to athletic',
			ethnicityPreference: 'African American or Caribbean',
			faithLevel: 'Christian background',
			incomeExpectation: 'must have career',
		},
		personality: {
			traits: ['driven', 'articulate', 'selective'],
			interests: ['law', 'golf', 'fine dining'],
			communicationStyle: 'precise, eloquent',
		},
		notes: `MATCHMAKER: Law partner (David)
HOW THEY HEARD: David's wife used similar service

WHY SINGLE (per matchmaker): "Very high standards. Successful lawyer but intimidates women and is critical."

RELATIONSHIP HISTORY: 2-3 year relationship ended 5 years ago. Since then, dates but nothing serious.

PHYSICAL DESCRIPTION:
- Height: 6'0"
- Build: Slim
- Fitness level: Plays golf, occasional gym
- Style: Impeccable, luxury brands
- Social media: LinkedIn only

PREFERENCES STATED:
- Physical: Very attractive, slim, well-dressed
- Faith: Christian background
- Career/Income: Must be professional with career ($80k+)
- Age range: 28-36
- Ethnicity: African American or Caribbean

DEAL BREAKERS (non-standard):
- Must be educated (graduate degree preferred)
- Must dress well
- No "ghetto" behavior
- Must be able to hold conversation at firm events

EXPECTATIONS ASSESSMENT: Somewhat high but he brings a lot to the table

RED FLAGS DETECTED:
- Very critical/selective
- May be looking for trophy wife
- "Ghetto" comment concerning

FLEXIBILITY DISCUSSIONS: Discussed income requirement. Said $60k minimum if she has ambition.`,
	},
	{
		name: 'Ikenna Uche',
		age: 28,
		location: 'Dallas, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 30, max: 38 },
			heightPreference: 'not important',
			fitnessPreference: 'any',
			ethnicityPreference: 'Nigerian',
			faithLevel: 'Christian',
		},
		personality: {
			traits: ['hardworking', 'humble', 'focused'],
			interests: ['medicine', 'soccer', 'family'],
			communicationStyle: 'respectful, traditional',
		},
		notes: `MATCHMAKER: Older sister (Adaora)
HOW THEY HEARD: Nigerian medical association

WHY SINGLE (per matchmaker): "He's been in residency forever. No time. Now he's looking and prefers older women."

RELATIONSHIP HISTORY: Brief relationships during med school. Nothing serious.

PHYSICAL DESCRIPTION:
- Height: 5'10"
- Build: Slim
- Fitness level: Runs occasionally
- Style: Professional casual
- Social media: Private

PREFERENCES STATED:
- Physical: Not picky
- Faith: Christian
- Career/Income: Professional preferred
- Age range: 30-38 (prefers older women)
- Ethnicity: Nigerian

DEAL BREAKERS (non-standard):
- Must understand his demanding schedule
- Must be mature (why he wants older)

EXPECTATIONS ASSESSMENT: Unique but realistic - young doctor wanting older woman is unusual but workable

RED FLAGS DETECTED: None - seems mature beyond his years

FLEXIBILITY DISCUSSIONS: Open to most things. Sister approves of older woman preference.`,
	},
	{
		name: 'Andre Cooper',
		age: 50,
		location: 'Houston, TX',
		gender: 'male',
		preferences: {
			ageRange: { min: 28, max: 38 },
			heightPreference: '5\'2" to 5\'7"',
			fitnessPreference: 'slim required',
			ethnicityPreference: 'any',
			faithLevel: 'believes in God',
		},
		personality: {
			traits: ['confident', 'successful', 'set in ways'],
			interests: ['business', 'cars', 'travel'],
			communicationStyle: 'direct, business-like',
		},
		notes: `MATCHMAKER: Business partner (James)
HOW THEY HEARD: James' wife suggested it

WHY SINGLE (per matchmaker): Divorced twice. Kids are grown. Wants a "young, pretty wife" to enjoy life with.

RELATIONSHIP HISTORY: Married twice. First marriage 10 years (3 kids, now adults). Second marriage 5 years (no kids).

PHYSICAL DESCRIPTION:
- Height: 5'9"
- Build: Plus-size, carries weight in middle
- Fitness level: Not active
- Style: Business casual, nice car
- Social media: Facebook

PREFERENCES STATED:
- Physical: MUST be slim and attractive, much younger
- Faith: Not important
- Career/Income: Doesn't care, he provides
- Age range: 28-38 ONLY (22 years younger!)
- Ethnicity: Any

DEAL BREAKERS (non-standard):
- No overweight women
- Must be significantly younger
- Must be comfortable being "taken care of"

EXPECTATIONS ASSESSMENT: MAJOR MISMATCH - 50, plus-size, twice divorced but wants slim woman 20+ years younger. Money may attract some, but this is trophy wife territory.

RED FLAGS DETECTED:
- Two divorces (pattern)
- Major age gap desire
- Plus-size but requires slim
- Transactional view of relationships

FLEXIBILITY DISCUSSIONS: Not flexible. Says he's "earned" a young beautiful wife through his success.

MY ADVANTAGE OVER PREVIOUS ATTEMPTS: Need honest conversation about what he's really offering vs. asking for. May attract gold diggers, not genuine matches.`,
	},
]

async function seedDatabase() {
	console.log('Loading configuration...')
	let config = await loadConfig()
	let apiClient = new ApiClient(config)

	console.log('Starting seed process...')
	console.log(`Will create ${femaleProfiles.length} female and ${maleProfiles.length} male profiles\n`)

	let allProfiles = [...femaleProfiles, ...maleProfiles]
	let created = 0
	let errors = 0

	for (let profile of allProfiles) {
		try {
			console.log(`Creating: ${profile.name}...`)

			// First add the person
			let person = await apiClient.addPerson(profile.name)
			console.log(`  Added with ID: ${person.id}`)

			// Then update with full profile
			await apiClient.updatePerson(person.id, {
				age: profile.age,
				location: profile.location,
				gender: profile.gender,
				preferences: profile.preferences,
				personality: profile.personality,
				notes: profile.notes,
			})
			console.log(`  Updated with full profile`)

			created++
		} catch (error) {
			console.error(`  ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
			errors++
		}
	}

	console.log('\n--- Seed Complete ---')
	console.log(`Created: ${created}`)
	console.log(`Errors: ${errors}`)
}

// Run if executed directly
seedDatabase().catch(error => {
	console.error('Fatal error:', error)
	process.exit(1)
})
