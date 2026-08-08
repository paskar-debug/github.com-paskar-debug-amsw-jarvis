export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          status: "todo" | "in_progress" | "done" | "cancelled";
          priority: "p1" | "p2" | "p3" | "p4";
          due_at: string | null;
          source: "manual" | "telegram" | "todoist";
          external_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tasks"]["Row"]> & {
          owner_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
      calendar_events: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          location: string | null;
          starts_at: string;
          ends_at: string;
          source: "manual" | "google";
          external_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["calendar_events"]["Row"]> & {
          owner_id: string;
          title: string;
          starts_at: string;
          ends_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_events"]["Row"]>;
        Relationships: [];
      };
      amsw_status: {
        Row: {
          id: string;
          owner_id: string;
          area: string;
          state: "green" | "yellow" | "red";
          note: string | null;
          metrics: Record<string, unknown>;
          recorded_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["amsw_status"]["Row"]> & {
          owner_id: string;
          area: string;
          state: "green" | "yellow" | "red";
        };
        Update: Partial<Database["public"]["Tables"]["amsw_status"]["Row"]>;
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          category: string | null;
          status: "active" | "paused" | "done" | "cancelled";
          progress: number;
          target_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["goals"]["Row"]> & {
          owner_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["goals"]["Row"]>;
        Relationships: [];
      };
      wellbeing_entries: {
        Row: {
          id: string;
          owner_id: string;
          mood: number;
          energy: number;
          sleep_hours: number | null;
          note: string | null;
          recorded_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["wellbeing_entries"]["Row"]> & {
          owner_id: string;
          mood: number;
          energy: number;
        };
        Update: Partial<Database["public"]["Tables"]["wellbeing_entries"]["Row"]>;
        Relationships: [];
      };
      integration_sync_state: {
        Row: {
          owner_id: string;
          source: "google_calendar" | "todoist" | "shopify";
          last_synced_at: string | null;
          cursor: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["integration_sync_state"]["Row"]> & {
          owner_id: string;
          source: "google_calendar" | "todoist" | "shopify";
        };
        Update: Partial<Database["public"]["Tables"]["integration_sync_state"]["Row"]>;
        Relationships: [];
      };
      drafts: {
        Row: {
          id: string;
          owner_id: string;
          request: string;
          content: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["drafts"]["Row"]> & {
          owner_id: string;
          request: string;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["drafts"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
