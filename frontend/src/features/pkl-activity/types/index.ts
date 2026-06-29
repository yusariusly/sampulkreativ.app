/**
 * @file types/index.ts
 * @description TypeScript interfaces and types for the PKL Activity feature, mapped from OpenAPI schemas.
 */

export interface BaseResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}

// Student Dashboard Types
export interface StudentDashboardData {
  today: {
    date: string;
    clothes: string;
    attendance_status: string;
    attendance_time: string | null;
  };
  progress: {
    active_week: number;
    total_weeks: number;
    percentage: number;
  };
  program_kerja: {
    title: string;
    tasks: Array<{
      task_id: string;
      title: string;
      is_completed: boolean;
    }>;
    active_week?: number;
    weeks?: Array<{
      id: string;
      week_number: number;
      month_number: number;
      milestone_title: string;
      tasks: Array<{
        task_id: string;
        title: string;
        is_completed: boolean;
        is_mandatory: boolean;
      }>;
    }>;
  };
  papan_apresiasi: {
    is_published: boolean;
    week_number?: number;
    total_points?: number;
    aspects?: {
      wkt_point: number;
      skp_point: number;
      has_point: number;
      ker_point: number;
      ini_point: number;
    };
    feedback?: {
      tags: string[];
      comments: string | null;
    } | null;
    message?: string;
  } | null;
  aspect_settings?: Array<{
    aspect_key: string;
    label: string;
    icon_name: string;
    is_active: number;
  }>;
}

// Student History Types
export interface StudentHistoryItem {
  week_number: number;
  total_points: number;
  tags: string[];
  comments: string;
}

// Mentor Student Types
export interface MentorStudentCard {
  student_id: string;
  student_name: string;
  student_avatar: string | null;
  school_name: string;
  program_title: string;
  active_week: number;
  evaluations: {
    wkt_point: number;
    skp_point: number;
    has_point: number;
    ker_point: number;
    ini_point: number;
  } | null;
}

// Mentor Weekly Rekap Types
export interface WeeklyRekapItem {
  student_id: string;
  student_name: string;
  total_points: number;
  is_published: boolean;
  feedback: {
    tags: string[];
    comments: string | null;
  } | null;
}

// Payloads
export interface DailyEvaluationPayload {
  evaluation_date: string;
  student_id: string;
  wkt_point: 0 | 1;
  skp_point: 0 | 1;
  has_point: 0 | 1;
  ker_point: 0 | 1;
  ini_point: 0 | 1;
}

export interface SubmitSessionPayload {
  session_date: string;
}

export interface WeeklyFeedbackPayload {
  week_number: number;
  tags: string[];
  comments?: string | null;
}

export interface PublishSummaryPayload {
  week_number: number;
}
