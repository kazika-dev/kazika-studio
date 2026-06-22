-- Add formal image-generation prompt setting columns to Agent scene domain rows.
-- Runtime reads/writes these columns directly; do not store this setting in metadata.

alter table kazika_studio_agents.story_scenes_domain
  add column if not exists image_prompt_background text,
  add column if not exists image_prompt_character_placement text,
  add column if not exists image_prompt_props text,
  add column if not exists image_prompt_camera_composition text,
  add column if not exists image_prompt_lighting text,
  add column if not exists image_prompt_style_rules text,
  add column if not exists image_prompt_negative text,
  add column if not exists image_prompt_notes text,
  add column if not exists image_prompt_updated_at timestamp with time zone;

update kazika_studio_agents.story_scenes_domain
set
  metadata = metadata - 'image_generation_setting' - 'image_generation_settings' - 'image_generation_settings_updated_at',
  updated_at = now()
where metadata ? 'image_generation_setting'
   or metadata ? 'image_generation_settings'
   or metadata ? 'image_generation_settings_updated_at';
