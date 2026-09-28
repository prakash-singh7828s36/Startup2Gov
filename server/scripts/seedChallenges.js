import dotenv from 'dotenv';
import Challenge, { CHALLENGE_STATUS } from '../models/Challenge.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { slugify } from '../utils/slug.js';

dotenv.config();

const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

const formatDeadline = (daysAhead) => {
  const d = new Date(now + daysAhead * dayMs);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getDeadlineDate = (daysAhead) => new Date(now + daysAhead * dayMs);
const getPostedDate = (daysAgo) => new Date(now - daysAgo * dayMs);

export const SEED_CHALLENGES = [
  {
    customId: 1,
    title: 'Smart City Waste Management',
    department: 'Urban Development Department',
    category: 'CleanTech',
    location: 'Madhya Pradesh',
    budget: '₹20 L pilot grant',
    duration: '6-month pilot',
    featured: true,
    description:
      'Develop an innovative technology solution for efficient waste collection, segregation, and monitoring in urban areas.',
    requirements: [
      'Technology-based waste management solution',
      'Real-time monitoring capability',
      'Scalable for urban areas',
      'Citizen-friendly interface',
    ],
    tags: ['IoT', 'Sensors', 'Dashboard'],
    matchKeywords: [
      'waste',
      'segregation',
      'collection',
      'monitoring',
      'iot',
      'sensor',
      'urban',
      'sanitation',
      'dashboard',
    ],
    eligibility: {
      stages: ['MVP', 'Early Revenue', 'Growth'],
      needsDPIIT: false,
      minTeam: 2,
      note: 'Startup should have a deployable pilot version.',
    },
    deadline: formatDeadline(6),
    deadlineDate: getDeadlineDate(6),
    postedDate: getPostedDate(12),
  },
  {
    customId: 2,
    title: 'AI Based Traffic Management',
    department: 'Transport Department',
    category: 'Artificial Intelligence',
    location: 'Delhi',
    budget: '₹30 L pilot grant',
    duration: '9-month pilot',
    featured: true,
    description:
      'Build an AI-powered system to analyze traffic patterns and improve traffic flow across major city intersections.',
    requirements: [
      'AI-based traffic analysis',
      'Real-time traffic monitoring',
      'Traffic prediction capability',
      'Scalable solution',
    ],
    tags: ['AI', 'Computer Vision', 'Analytics'],
    matchKeywords: [
      'traffic',
      'ai',
      'prediction',
      'signal',
      'congestion',
      'computer vision',
      'analytics',
      'cameras',
    ],
    eligibility: {
      stages: ['MVP', 'Early Revenue', 'Growth'],
      needsDPIIT: false,
      minTeam: 2,
      note: 'Prior CCTV/video analytics experience preferred.',
    },
    deadline: formatDeadline(13),
    deadlineDate: getDeadlineDate(13),
    postedDate: getPostedDate(9),
  },
  {
    customId: 3,
    title: 'Digital Healthcare Platform',
    department: 'Health Department',
    category: 'Healthcare',
    location: 'Maharashtra',
    budget: '₹25 L pilot grant',
    duration: '6-month pilot',
    featured: true,
    description:
      'Create a platform connecting rural clinics with specialist doctors for remote consultation and diagnostic assistance.',
    requirements: [
      'Telemedicine infrastructure',
      'Low-bandwidth video streaming',
      'EHR integration capability',
      'Multi-language support (Hindi, Marathi)',
    ],
    tags: ['Telemedicine', 'EHR', 'Mobile App'],
    matchKeywords: [
      'health',
      'telemedicine',
      'remote',
      'clinic',
      'doctor',
      'consultation',
      'diagnostics',
      'ehr',
      'rural',
    ],
    eligibility: {
      stages: ['Early Revenue', 'Growth'],
      needsDPIIT: true,
      minTeam: 3,
      note: 'DPIIT recognized startups with ISO/HIPAA compliance roadmap.',
    },
    deadline: formatDeadline(21),
    deadlineDate: getDeadlineDate(21),
    postedDate: getPostedDate(14),
  },
  {
    customId: 4,
    title: 'Smart Agriculture Advisory',
    department: 'Agriculture Department',
    category: 'Agriculture',
    location: 'Punjab',
    budget: '₹15 L pilot grant',
    duration: '12-month pilot',
    featured: false,
    description:
      'Develop crop health monitoring and weather-based advisory system for smallholder farmers using satellite and ground sensors.',
    requirements: [
      'Satellite imagery processing',
      'Soil sensor data integration',
      'Hyperlocal weather forecasting',
      'Voice-based regional advisories',
    ],
    tags: ['AgriTech', 'Satellite', 'IoT'],
    matchKeywords: [
      'agriculture',
      'farming',
      'crop',
      'soil',
      'irrigation',
      'weather',
      'satellite',
      'sensor',
      'advisory',
      'pest',
    ],
    eligibility: {
      stages: ['Idea', 'MVP', 'Early Revenue', 'Growth'],
      needsDPIIT: false,
      minTeam: 2,
      note: 'Field trials in Punjab or Haryana are an advantage.',
    },
    deadline: formatDeadline(28),
    deadlineDate: getDeadlineDate(28),
    postedDate: getPostedDate(7),
  },
  {
    customId: 5,
    title: 'Automated Public Grievance Redressal',
    department: 'Department of Administrative Reforms',
    category: 'Governance',
    location: 'Pan-India',
    budget: '₹35 L pilot grant',
    duration: '6-month pilot',
    featured: false,
    description:
      'AI-powered natural language system to triage, route, and track citizen grievances submitted via web, WhatsApp, and voice.',
    requirements: [
      'NLP for 12 Indian languages',
      'Automated departmental routing',
      'Sentiment analysis and escalation',
      'Real-time resolution dashboard',
    ],
    tags: ['NLP', 'GovTech', 'AI'],
    matchKeywords: [
      'governance',
      'grievance',
      'nlp',
      'language',
      'citizen',
      'portal',
      'complaint',
      'routing',
      'escalation',
      'ai',
    ],
    eligibility: {
      stages: ['MVP', 'Early Revenue', 'Growth'],
      needsDPIIT: false,
      minTeam: 2,
      note: 'Demonstrable multilingual capability required at prototype stage.',
    },
    deadline: formatDeadline(35),
    deadlineDate: getDeadlineDate(35),
    postedDate: getPostedDate(15),
  },
  {
    customId: 6,
    title: 'Renewable Energy Grid Optimization',
    department: 'Ministry of New and Renewable Energy',
    category: 'CleanTech',
    location: 'Gujarat',
    budget: '₹40 L pilot grant',
    duration: '12-month pilot',
    featured: false,
    description:
      'Predictive analytics platform for forecasting solar/wind power generation and optimizing feeder-level grid distribution.',
    requirements: [
      'Solar/wind yield forecasting algorithms',
      'SCADA / smart-meter telemetry ingestion',
      'Battery energy storage scheduling',
      'Grid frequency stability alerts',
    ],
    tags: ['CleanTech', 'Energy', 'Forecasting'],
    matchKeywords: [
      'energy',
      'solar',
      'wind',
      'renewable',
      'grid',
      'scada',
      'forecasting',
      'battery',
      'cleantech',
      'power',
    ],
    eligibility: {
      stages: ['MVP', 'Early Revenue', 'Growth'],
      needsDPIIT: true,
      minTeam: 3,
      note: 'DPIIT recognized CleanTech startups with electrical/data-science engineering leads.',
    },
    deadline: formatDeadline(42),
    deadlineDate: getDeadlineDate(42),
    postedDate: getPostedDate(20),
  },
  {
    customId: 7,
    title: 'AI Drone Surveillance for Forest Fire Detection',
    department: 'Ministry of Environment, Forest & Climate Change',
    category: 'CleanTech',
    location: 'Uttarakhand',
    budget: '₹35 L pilot grant',
    duration: '9-month pilot',
    featured: true,
    description:
      'Autonomous UAV patrol network paired with thermal imaging to detect early-stage canopy wildfires in rugged Himalayan terrain.',
    requirements: [
      'Autonomous beyond-visual-line-of-sight (BVLOS) flight plans',
      'Thermal + optical dual-sensor payload',
      'Edge-computed smoke detection under 60 seconds',
      'Forest ranger distress-mesh integration',
    ],
    tags: ['Drones', 'Computer Vision', 'Thermal Imaging'],
    matchKeywords: ['drone', 'uav', 'wildfire', 'forest', 'thermal', 'camera', 'edge', 'fire', 'disaster'],
    eligibility: {
      stages: ['MVP', 'Early Revenue', 'Growth'],
      needsDPIIT: true,
      minTeam: 3,
      note: 'DGCA type-certified drone or clear certification roadmap required.',
    },
    deadline: formatDeadline(9),
    deadlineDate: getDeadlineDate(9),
    postedDate: getPostedDate(8),
  },
  {
    customId: 8,
    title: 'Blockchain-Based Land Record Verification',
    department: 'Department of Land Resources',
    category: 'Governance',
    location: 'Karnataka',
    budget: '₹45 L pilot grant',
    duration: '12-month pilot',
    featured: false,
    description:
      'Immutable ledger layer over Bhoomi land parcels to eradicate duplicate mutation claims and streamline encumbrance certificates.',
    requirements: [
      'EVM-compatible or Hyperledger Fabric permissioned network',
      'Sub-registrar office API bridge',
      'Biometric / Aadhaar-backed signing',
      'Zero-knowledge proof ownership verification',
    ],
    tags: ['Blockchain', 'Web3', 'GovTech'],
    matchKeywords: ['blockchain', 'land', 'registry', 'cadastral', 'mutation', 'ledger', 'smart contract', 'property'],
    eligibility: {
      stages: ['Early Revenue', 'Growth'],
      needsDPIIT: true,
      minTeam: 4,
      note: 'Security audit by CERT-In empaneled agency required before staging.',
    },
    deadline: formatDeadline(16),
    deadlineDate: getDeadlineDate(16),
    postedDate: getPostedDate(11),
  },
  {
    customId: 9,
    title: 'Telemedicine Booth for Primary Health Centres',
    department: 'Ministry of Health and Family Welfare',
    category: 'Healthcare',
    location: 'Odisha',
    budget: '₹22 L pilot grant',
    duration: '6-month pilot',
    featured: true,
    description:
      'Solar-powered, ruggedized telehealth kiosk capable of taking 14 vital parameters automatically and connecting patients to MBBS doctors.',
    requirements: [
      'Solar-battery hybrid powering (8h continuous operation)',
      '14 automated point-of-care diagnostics',
      'Satellite/4G failover connectivity',
      'ABDM (Ayushman Bharat Digital Mission) compliance',
    ],
    tags: ['HealthTech', 'Telehealth', 'Diagnostics'],
    matchKeywords: ['telemedicine', 'kiosk', 'vitals', 'rural', 'abdm', 'diagnostics', 'doctor', 'clinic', 'health'],
    eligibility: {
      stages: ['MVP', 'Early Revenue', 'Growth'],
      needsDPIIT: false,
      minTeam: 2,
      note: 'Hardware prototype must be ready for lab testing.',
    },
    deadline: formatDeadline(19),
    deadlineDate: getDeadlineDate(19),
    postedDate: getPostedDate(5),
  },
  {
    customId: 10,
    title: 'IoT-Based Water Pipeline Leakage Detection',
    department: 'Ministry of Jal Shakti',
    category: 'CleanTech',
    location: 'Rajasthan',
    budget: '₹28 L pilot grant',
    duration: '8-month pilot',
    featured: false,
    description:
      'Acoustic sensor clamps retrofitted onto drinking water mains to pinpoint underground bursts and unmetered extraction before surface pooling.',
    requirements: [
      'Non-invasive acoustic / transient pressure sensors',
      'LoRaWAN / NB-IoT backhaul for desert conditions',
      'Leak localization accuracy within 5 meters',
      'SCADA map dashboard for municipal engineers',
    ],
    tags: ['Water', 'IoT', 'Acoustics'],
    matchKeywords: ['water', 'leak', 'pipeline', 'acoustic', 'iot', 'lora', 'scada', 'jal', 'sensor', 'municipal'],
    eligibility: {
      stages: ['MVP', 'Early Revenue', 'Growth'],
      needsDPIIT: false,
      minTeam: 2,
      note: 'Piloting planned on a 40 km test main in Jodhpur district.',
    },
    deadline: formatDeadline(24),
    deadlineDate: getDeadlineDate(24),
    postedDate: getPostedDate(10),
  },
  {
    customId: 11,
    title: 'Smart Classroom & Vernacular Learning Assistant',
    department: 'Ministry of Education',
    category: 'Education',
    location: 'Bihar',
    budget: '₹18 L pilot grant',
    duration: '6-month pilot',
    featured: false,
    description:
      'Offline-first tablet learning companion using small language models to teach foundational numeracy and literacy in Bhojpuri and Maithili.',
    requirements: [
      'Runs completely offline on low-end ₹7,000 tablets',
      'Speech-to-speech feedback in Bhojpuri and Maithili',
      'Automatic grading of handwritten math on slate photos',
      'Teacher sync via micro-SD or periodic hot-spots',
    ],
    tags: ['EdTech', 'Offline-First', 'Vernacular'],
    matchKeywords: ['education', 'learning', 'vernacular', 'offline', 'tablet', 'school', 'literacy', 'speech', 'bhojpuri'],
    eligibility: {
      stages: ['MVP', 'Early Revenue', 'Growth'],
      needsDPIIT: false,
      minTeam: 2,
      note: 'Class 3-5 curriculum aligned to NEP 2020.',
    },
    deadline: formatDeadline(30),
    deadlineDate: getDeadlineDate(30),
    postedDate: getPostedDate(4),
  },
  {
    customId: 12,
    title: 'Agritech Mandi Price Forecast & Farmer Advisory',
    department: 'Department of Agriculture and Farmers Welfare',
    category: 'Agriculture',
    location: 'Odisha',
    budget: '₹10 L pilot grant',
    duration: '2 crop seasons',
    featured: false,
    description:
      'Forecast mandi prices for paddy and vegetables and push simple Odia/Hindi SMS advisories telling farmers when and where to sell.',
    requirements: [
      'Mandi price forecasting',
      'SMS advisories in Odia + Hindi',
      'Works without smartphones',
      'Farmer feedback loop',
    ],
    tags: ['Mandis', 'Forecasting', 'SMS'],
    matchKeywords: ['mandi', 'price', 'forecast', 'sms', 'advisory', 'farmer', 'odia', 'hindi', 'crop'],
    eligibility: {
      stages: ['Idea', 'MVP', 'Early Revenue'],
      needsDPIIT: false,
      minTeam: 2,
      note: 'Agmarknet data access included.',
    },
    deadline: formatDeadline(14),
    deadlineDate: getDeadlineDate(14),
    postedDate: getPostedDate(7),
  },
];

export async function seedChallenges() {
  console.log('[Seed Challenges] Checking database connection...');
  const connected = await connectDB();
  if (!connected) {
    console.warn('[Seed Challenges] Database connection unavailable. Skipping challenge seeding.');
    return;
  }

  try {
    for (const c of SEED_CHALLENGES) {
      const slug = slugify(c.title);
      // Check if exists by customId
      const existing = await Challenge.findOne({
        $or: [{ customId: c.customId }, { slug: `${slug}-${c.customId}` }],
      });

      if (existing) {
        // If it's a demo challenge, keep it fresh without touching any user-created records
        if (existing.isDemo) {
          existing.deadline = c.deadline;
          existing.deadlineDate = c.deadlineDate;
          existing.postedDate = c.postedDate;
          existing.status = CHALLENGE_STATUS.OPEN;
          await existing.save();
          console.log(`[Seed Challenges] Refreshed demo challenge #${c.customId}: ${c.title}`);
        } else {
          console.log(`[Seed Challenges] Skipping custom challenge #${c.customId}`);
        }
      } else {
        await Challenge.create({
          ...c,
          slug: `${slug}-${c.customId}`,
          status: CHALLENGE_STATUS.OPEN,
          isDemo: true,
          createdBy: null,
          createdByName: 'Government of India (Public Program)',
        });
        console.log(`[Seed Challenges] Created demo challenge #${c.customId}: ${c.title}`);
      }
    }
    console.log('[Seed Challenges] All 12 public demo challenges are seeded.');
  } catch (err) {
    console.error('[Seed Challenges] Error seeding challenges:', err.message);
  }
}

// If executed directly from CLI: node scripts/seedChallenges.js
if (process.argv[1]?.endsWith('seedChallenges.js')) {
  (async () => {
    await seedChallenges();
    await disconnectDB();
    process.exit(0);
  })();
}
