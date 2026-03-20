export interface SearchParams {
  keyword: string;
  location: string;
  country: string;
  language: string;
  limit: number;
  minReviews: number;
}

export interface WorkingHours {
  [day: string]: string;
}

export interface MapResult {
  business_id: string;
  name: string;
  full_address: string;
  phone_number: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  latitude: number | null;
  longitude: number | null;
  working_hours: WorkingHours | null;
  place_id: string | null;
  timezone: string | null;
  types: string | string[] | null;
  is_permanently_closed: boolean | null;
  is_temporarily_closed: boolean | null;
  _location: string; // injected client-side to track which search location produced this result
  _keyword: string;  // injected client-side to track which keyword produced this result
}

export interface ContactInfo {
  emails: string[];
  phones: string[];
}

export type ContactsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: ContactInfo }
  | { status: 'error'; message: string };

export type SortKey = 'name' | 'rating' | 'review_count';
export type SortDir = 'asc' | 'desc';

export interface SortConfig {
  key: SortKey;
  dir: SortDir;
}
