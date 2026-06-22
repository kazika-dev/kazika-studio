-- Remove legacy video provider/model mirrors from script-line metadata.
-- The source of truth is kazika_studio_agents.script_lines.video_generation_provider.
-- Keep non-provider metadata such as dialogue_video_generation_mode, mux flags, checks, assets, etc.

with cleaned as (
  select
    id,
    metadata - 'video_generation_provider' - 'dialogue_video_generation_provider' as base_metadata,
    case
      when jsonb_typeof(metadata->'video_generation_settings') = 'object' then
        (metadata->'video_generation_settings')
          - 'video_generation_provider'
          - 'video_provider'
          - 'ltx_workflow_mode'
          - 'ltx_flf2v_first_frame_source'
          - 'ltx_flf2v_end_frame_source'
          - 'ltx_flf2v_use_same_primary_image_for_first_and_last_frame'
      else null
    end as cleaned_video_settings
  from kazika_studio_agents.script_lines
  where metadata ? 'video_generation_provider'
     or metadata ? 'dialogue_video_generation_provider'
     or metadata ? 'video_generation_settings'
)
update kazika_studio_agents.script_lines sl
set metadata = case
  when cleaned.cleaned_video_settings is null then cleaned.base_metadata
  when cleaned.cleaned_video_settings = '{}'::jsonb then cleaned.base_metadata - 'video_generation_settings'
  else jsonb_set(cleaned.base_metadata, '{video_generation_settings}', cleaned.cleaned_video_settings, true)
end,
updated_at = now()
from cleaned
where sl.id = cleaned.id;
