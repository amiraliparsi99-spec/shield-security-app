// Mock Birmingham data for dashboard. Mirror of web’s dashboard-mock.

export interface VenueRequest {
  id: string;
  title: string;
  guardsCount: number;
  start: string;
  end?: string;
  certsRequired?: string[];
  rateOffered?: number;
  description?: string;
}

export interface Venue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  description?: string;
  venueType?: string;
  capacity?: number;
  openRequests: VenueRequest[];
}

export const BIRMINGHAM_CENTER = { lat: 52.4862, lng: -1.8904 } as const;

export const BIRMINGHAM_VENUES: Venue[] = [
  {
    id: "v1",
    name: "The Nightingale Club",
    lat: 52.4795,
    lng: -1.9022,
    address: "18 Kent St, Birmingham B5 6RD",
    description: "One of Birmingham's largest and longest-running LGBTQ+ clubs. High-energy, late-night venue with multiple floors and busy bars. We need reliable, personable door staff who can handle high footfall and alcohol-serving environments.",
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
    description: "Bar and late-night venue in the heart of the city. Popular with students and weekend crowds. We're looking for calm, professional door staff for busy Saturday nights.",
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

export function getVenueById(id: string): Venue | undefined {
  return BIRMINGHAM_VENUES.find((v) => v.id === id);
}

export interface Agency {
  id: string;
  name: string;
  types: string[];
  address?: string;
  location_name: string;
  description?: string;
  staff_range?: string;
  rate_from?: string;
}

export const AGENCIES: Agency[] = [
  { id: "a1", name: "Metro Door Sec", types: ["Door supervision", "Event security"], address: "12 Navigation St, Birmingham B2 4BT", location_name: "Birmingham city centre", description: "Licensed premises and night-time economy specialists. SIA door supervisors for clubs, bars, and events.", staff_range: "20–50", rate_from: "From £24/hr" },
  { id: "a2", name: "Apex Event Security", types: ["Event security", "Festival & outdoor", "Stadium & arena"], address: "Unit 4, Digbeth Trading Estate, Birmingham B5 6PA", location_name: "Digbeth, Birmingham", description: "Concert, festival, and stadium teams. Large crowds, backstage, multi-site.", staff_range: "50+", rate_from: "From £26/hr" },
  { id: "a3", name: "Shield Corporate Ltd", types: ["Corporate & office", "Retail"], address: "One Centenary Way, Birmingham B1 1AA", location_name: "Birmingham", description: "Reception, static, and retail. Corporate HQ and high-street. Flexible contracts.", staff_range: "15–40", rate_from: "From £22/hr" },
  { id: "a4", name: "Nightwatch CCTV", types: ["CCTV & remote", "Retail", "Construction & static"], location_name: "Solihull, West Midlands", description: "Remote monitoring and on-site static. Retail, construction, vacant property. 24/7 control room.", staff_range: "10–30", rate_from: "From £20/hr" },
  { id: "a5", name: "Broad Street Security", types: ["Door supervision", "Event security"], address: "Broad St, Birmingham B15 1AU", location_name: "Broad Street, Birmingham", description: "Broad Street and city-centre licensed premises. Weekend and event cover.", staff_range: "25–60", rate_from: "From £25/hr" },
];

export function getAgencyById(id: string): Agency | undefined {
  return AGENCIES.find((a) => a.id === id);
}

export const AVAILABLE_PERSONNEL = [
  { id: "p1", display_name: "Marcus Webb", location: "Birmingham, West Midlands", experience: "8 years · Since 2016", certs: "SIA, First Aid, CCTV", rate: "£28.50/hr", status: "available" as const },
  { id: "p2", display_name: "Jordan Reid", location: "Digbeth, Birmingham", experience: "4 years · Since 2020", certs: "SIA, First Aid", rate: "£22.00/hr", status: "available" as const },
  { id: "p3", display_name: "Samira Hussein", location: "Solihull, West Midlands", experience: "6 years · Since 2018", certs: "SIA, First Aid, CCTV", rate: "£26.00/hr", status: "looking" as const },
  { id: "p4", display_name: "Danny Cole", location: "Edgbaston, Birmingham", experience: "3 years · Since 2021", certs: "SIA, First Aid", rate: "£20.00/hr", status: "available" as const },
  { id: "p5", display_name: "Alex Turner", location: "Birmingham city centre", experience: "5 years · Since 2019", certs: "SIA, First Aid, CCTV", rate: "£24.00/hr", status: "available" as const },
];
