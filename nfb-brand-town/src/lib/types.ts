export type FloorKind = 'lobby' | 'classroom' | 'library' | 'sns' | 'rooftop'
export type ChannelType = 'blog' | 'instagram' | 'youtube' | 'threads' | 'etc'

export interface ItemLite {
  id: string
  name: string
  emoji: string | null
  image_url: string | null
  slot: 'floor' | 'wall'
}

export interface Placement {
  slot_key: string
  inventory_id: string
  item: ItemLite
}

export interface RecordLite {
  id: string
  url: string | null
  note: string
  day: string
  input_type: 'url' | 'photo' | 'check'
}

export interface Floor {
  id: string
  kind: FloorKind
  channel_type: ChannelType | null
  channel_name: string
  channel_url: string
  position: number
  wall_color: string | null
  record_count: number
  recent_records: RecordLite[]
  placements: Placement[]
}

export interface Profile {
  id: string
  nickname: string
  brand_name: string
  tagline: string
  brand_color: string
  plot_no: number
  is_public: boolean
  public_key: string | null
  weekly_goal: number
  created_at: string
}

export interface CourseProgress {
  course_id: string
  title: string
  kind: 'course' | 'free'
  session_count: number
  enrolled: boolean
  stamps: number[]
}

export interface Completion {
  id: string
  cert_no: number
  course_id: string
  title: string
  completed_on: string | null
  status: 'requested' | 'approved' | 'rejected'
  item: { name: string; emoji: string | null; image_url: string | null } | null
}

export interface Reading {
  id: string
  book_id: string
  title: string
  author: string
  cover_url: string | null
  note: string
  attended: boolean
  created_at: string
}

export interface Taste {
  id: string
  kind: 'pick' | 'text' | 'photo'
  shape: 'object' | 'book' | 'record' | 'note' | 'photo'
  label: string
  emoji: string | null
  photo_path: string | null
}

export type NewsKind = 'first_lecture' | 'book' | 'press' | 'income' | 'collab' | 'award' | 'etc'

export interface News {
  id: string
  kind: NewsKind
  note: string
  url: string | null
  photo_path: string | null
  created_at: string
  featured: boolean
  consent: boolean | null
  name_display: 'real' | 'nick' | 'anon' | null
  on_banner: boolean
}

export interface MyBook {
  id: string
  title: string
  stage: 'plan' | 'toc' | 'draft' | 'cover' | 'published'
  cover_url: string | null
  isbn: string | null
  buy_url: string | null
}

export interface Building {
  profile: Profile
  floors: Floor[]
  stars_earned: number
  stamps: number
  records: number
  week: { start: string; count: number; goal: number; stamped: boolean }
  courses: CourseProgress[]
  completions: Completion[]
  readings: Reading[]
  taste: Taste[]
  news: News[]
  my_books: MyBook[]
  cheers: number
  cheered_today?: boolean
}

export interface WeekRecord {
  id: string
  floor_id: string
  input_type: 'url' | 'photo' | 'check'
  url: string | null
  note: string
  day: string
  starred: boolean
  created_at: string
}

export interface Today {
  today: string
  week_start: string
  balance: number
  week_records: WeekRecord[]
  stamp_weeks: string[]
  recent_cheers: { from: string; day: string }[]
  pending_completions: number
}

export interface TownBuilding {
  id: string
  nickname: string
  brand_name: string
  brand_color: string
  plot_no: number
  floors: { kind: FloorKind; channel_type: ChannelType | null; wall_color: string | null }[]
  week_count: number
  banner: { id: string; kind: NewsKind; note: string } | null
  cheered_today: boolean
}

export interface Town {
  me: string
  buildings: TownBuilding[]
  news: { id: string; user_id: string; nickname: string; kind: NewsKind; note: string; created_at: string; featured: boolean }[]
  week_total: number
}

export interface Item {
  id: string
  name: string
  kind: 'object' | 'wall_paint'
  slot: 'floor' | 'wall'
  price: number
  image_url: string | null
  emoji: string | null
  color: string | null
  source: 'shop' | 'reward'
  season: string
  sale_start: string | null
  sale_end: string | null
  active: boolean
  sort: number
}

export interface InventoryRow {
  id: string
  item_id: string
  source: string
  items: Item
}

export interface Course {
  id: string
  liveklass_seq: string | null
  title: string
  kind: 'course' | 'free'
  session_count: number
  thumbnail_url: string | null
  product_url: string | null
  reward_item_id: string | null
  stamp_open: boolean
  active: boolean
  sort: number
}

export interface Book {
  id: string
  title: string
  author: string
  cover_url: string | null
  month: string | null
  active: boolean
}
