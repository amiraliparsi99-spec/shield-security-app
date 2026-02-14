/**
 * Mock data for the Birmingham dashboard.
 * Replace with Supabase queries when backend is wired.
 */

import type { Personnel } from "@/types/database";

// Birmingham centre
export const BIRMINGHAM_CENTER = { lat: 52.4862, lng: -1.8904 } as const;

export interface OpenRequest {
  id: string;
  title: string;
  guardsCount: number;
  start: string;
  end?: string;
  certsRequired?: string[];
  rateOffered?: number; // pence
  description?: string;
}

export interface VenueWithRequests {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  description?: string;
  venueType?: string;
  capacity?: number;
  openRequests: OpenRequest[];
}

export const BIRMINGHAM_VENUES: VenueWithRequests[] = [
  {
    id: "v1",
    name: "The Nightingale Club",
    lat: 52.4795,
    lng: -1.9022,
    address: "18 Kent St, Birmingham B5 6RD",
    description: "One of Birmingham’s largest and longest-running LGBTQ+ clubs. High-energy, late-night venue with multiple floors and busy bars. We need reliable, personable door staff who can handle high footfall and alcohol-serving environments.",
    venueType: "club",
    capacity: 800,
    openRequests: [
      { id: "r1", title: "Weekend shift", guardsCount: 3, start: "2025-01-25T21:00:00", end: "2025-01-26T03:00:00", certsRequired: ["SIA Door Supervisor", "First Aid"], rateOffered: 2800, description: "Main doors and upstairs bar. Experience with clubs preferred." },
      { id: "r2", title: "Friday doors", guardsCount: 2, start: "2025-01-24T19:00:00", end: "2025-01-25T02:00:00", certsRequired: ["SIA Door Supervisor"], rateOffered: 2600 },
    ],
  },
  {
    id: "v2",
    name: "The Sun on the Hill",
    lat: 52.4721,
    lng: -1.8789,
    address: "26-28 Hill St, Birmingham B5 4UA",
    description: "Bar and late-night venue in the heart of the city. Popular with students and weekend crowds. We’re looking for calm, professional door staff for busy Saturday nights.",
    venueType: "bar",
    capacity: 350,
    openRequests: [
      { id: "r3", title: "Saturday night", guardsCount: 4, start: "2025-01-26T20:00:00", end: "2025-01-27T02:00:00", certsRequired: ["SIA Door Supervisor", "First Aid"], rateOffered: 2500, description: "Full night cover. ID checks, crowd control, and liaison with management." },
    ],
  },
  {
    id: "v3",
    name: "The Basement",
    lat: 52.4912,
    lng: -1.8823,
    address: "58-62 Broad St, Birmingham B15 1AU",
    description: "Live music and events space on Broad Street. Hosts bands, DJ nights, and private events. Need SIA-licensed staff who are used to event turnarounds and mixed crowds.",
    venueType: "event_space",
    capacity: 500,
    openRequests: [
      { id: "r4", title: "Thu event", guardsCount: 2, start: "2025-01-23T18:00:00", end: "2025-01-24T00:00:00", certsRequired: ["SIA Door Supervisor"], rateOffered: 2400 },
      { id: "r5", title: "New Year week", guardsCount: 3, start: "2025-01-27T19:00:00", end: "2025-01-28T01:00:00", certsRequired: ["SIA Door Supervisor", "First Aid"], rateOffered: 2700, description: "Special event. Extra footfall expected." },
    ],
  },
  {
    id: "v4",
    name: "Echo Arena Birmingham",
    lat: 52.4845,
    lng: -1.8934,
    address: "King Edwards Rd, Birmingham B1 2AA",
    description: "Major indoor arena for concerts, sports, and large-scale events. We regularly need experienced, professional security teams. SIA and First Aid essential; ability to work as part of a larger team is a must.",
    venueType: "stadium",
    capacity: 15000,
    openRequests: [
      { id: "r6", title: "Concert night", guardsCount: 8, start: "2025-01-28T17:00:00", end: "2025-01-29T00:00:00", certsRequired: ["SIA Door Supervisor", "First Aid", "CCTV (PSS)"], rateOffered: 3000, description: "Full arena event. Multiple posts: doors, floor, backstage, and CCTV. Must be available for full shift and briefing." },
    ],
  },
  {
    id: "v5",
    name: "The Victoria",
    lat: 52.4767,
    lng: -1.9012,
    address: "48 John Bright St, Birmingham B1 1BN",
    description: "Pub and live music venue near New Street. Friendly, busy spot. We need one or two door staff for weekend and event nights. Ideal for someone who likes a mix of pub and gig work.",
    venueType: "bar",
    capacity: 200,
    openRequests: [
      { id: "r7", title: "Weekend cover", guardsCount: 2, start: "2025-01-25T18:00:00", end: "2025-01-26T00:00:00", certsRequired: ["SIA Door Supervisor"], rateOffered: 2200 },
    ],
  },
];

export function getVenueById(id: string): VenueWithRequests | undefined {
  return BIRMINGHAM_VENUES.find((v) => v.id === id);
}

// Agency types: Door supervision, Event security, Corporate, Retail, Stadium & arena, CCTV, Construction, Festival
export interface Agency {
  id: string;
  name: string;
  types: string[];
  address?: string;
  location_name: string;
  description?: string;
  staff_range?: string; // e.g. "15–60" or "50+"
  rate_from?: string;   // e.g. "From £22/hr"
}

export const AGENCIES: Agency[] = [
  {
    id: "a1",
    name: "Metro Door Sec",
    types: ["Door supervision", "Event security"],
    address: "12 Navigation St, Birmingham B2 4BT",
    location_name: "Birmingham city centre",
    description: "Licensed premises and night-time economy specialists. SIA door supervisors for clubs, bars, and events across the West Midlands.",
    staff_range: "20–50",
    rate_from: "From £24/hr",
  },
  {
    id: "a2",
    name: "Apex Event Security",
    types: ["Event security", "Festival & outdoor", "Stadium & arena"],
    address: "Unit 4, Digbeth Trading Estate, Birmingham B5 6PA",
    location_name: "Digbeth, Birmingham",
    description: "Concert, festival, and stadium teams. Experienced in large crowds, backstage, and multi-site events.",
    staff_range: "50+",
    rate_from: "From £26/hr",
  },
  {
    id: "a3",
    name: "Shield Corporate Ltd",
    types: ["Corporate & office", "Retail"],
    address: "One Centenary Way, Birmingham B1 1AA",
    location_name: "Birmingham",
    description: "Reception, static, and retail security. Corporate HQ and high-street coverage. Flexible contracts.",
    staff_range: "15–40",
    rate_from: "From £22/hr",
  },
  {
    id: "a4",
    name: "Nightwatch CCTV",
    types: ["CCTV & remote", "Retail", "Construction & static"],
    location_name: "Solihull, West Midlands",
    description: "Remote monitoring and on-site static. Retail, construction, and vacant property. 24/7 control room.",
    staff_range: "10–30",
    rate_from: "From £20/hr",
  },
  {
    id: "a5",
    name: "Broad Street Security",
    types: ["Door supervision", "Event security"],
    address: "Broad St, Birmingham B15 1AU",
    location_name: "Broad Street, Birmingham",
    description: "Broad Street and city-centre licensed premises. Weekend and event cover. SIA Door Supervisor teams.",
    staff_range: "25–60",
    rate_from: "From £25/hr",
  },
];

export function getAgencyById(id: string): Agency | undefined {
  return AGENCIES.find((a) => a.id === id);
}

export const AVAILABLE_PERSONNEL: (Personnel & { avatar_url?: string | null })[] = [
  {
    id: "p1",
    user_id: "u1",
    display_name: "Marcus Webb",
    bio: "SIA-licensed door supervisor. 8+ years in clubs, festivals, and corporate events.",
    certs: ["SIA Door Supervisor", "First Aid at Work", "CCTV (PSS)"],
    experience_years: 8,
    experience_since_year: 2016,
    rate_per_hour: 2850,
    currency: "GBP",
    city: "Birmingham",
    region: "West Midlands",
    country: "UK",
    location_name: "Birmingham, West Midlands",
    lat: 52.4862,
    lng: -1.8904,
    status: "available",
    insurance_verified: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "p2",
    user_id: "u2",
    display_name: "Jordan Reid",
    bio: "Event and retail security. Calm under pressure.",
    certs: ["SIA Door Supervisor", "First Aid"],
    experience_years: 4,
    experience_since_year: 2020,
    rate_per_hour: 2200,
    currency: "GBP",
    city: "Birmingham",
    region: "West Midlands",
    country: "UK",
    location_name: "Digbeth, Birmingham",
    lat: 52.4712,
    lng: -1.8756,
    status: "available",
    insurance_verified: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "p3",
    user_id: "u3",
    display_name: "Samira Hussein",
    bio: "Corporate and festival experience. SIA licensed.",
    certs: ["SIA Door Supervisor", "First Aid at Work", "CCTV (PSS)"],
    experience_years: 6,
    experience_since_year: 2018,
    rate_per_hour: 2600,
    currency: "GBP",
    city: "Solihull",
    region: "West Midlands",
    country: "UK",
    location_name: "Solihull, West Midlands",
    lat: 52.4118,
    lng: -1.7776,
    status: "looking",
    insurance_verified: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "p4",
    user_id: "u4",
    display_name: "Danny Cole",
    bio: "Door supervisor. Used to high-volume, alcohol-serving venues.",
    certs: ["SIA Door Supervisor", "First Aid"],
    experience_years: 3,
    experience_since_year: 2021,
    rate_per_hour: 2000,
    currency: "GBP",
    city: "Birmingham",
    region: "West Midlands",
    country: "UK",
    location_name: "Edgbaston, Birmingham",
    lat: 52.4604,
    lng: -1.9297,
    status: "available",
    insurance_verified: false,
    created_at: "",
    updated_at: "",
  },
  {
    id: "p5",
    user_id: "u5",
    display_name: "Alex Turner",
    bio: "Events and stadium experience. SIA, First Aid, CCTV.",
    certs: ["SIA Door Supervisor", "First Aid at Work", "CCTV (PSS)"],
    experience_years: 5,
    experience_since_year: 2019,
    rate_per_hour: 2400,
    currency: "GBP",
    city: "Birmingham",
    region: "West Midlands",
    country: "UK",
    location_name: "Birmingham city centre",
    lat: 52.4862,
    lng: -1.8904,
    status: "available",
    insurance_verified: true,
    created_at: "",
    updated_at: "",
  },
];
