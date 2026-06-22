-- Store script-line video generation provider as a first-class column.
-- This column is the source of truth; later migrations remove legacy metadata mirrors.

alter table kazika_studio_agents.script_lines
  add column if not exists video_generation_provider text not null default 'ltx_2_3_flf2v';

alter table kazika_studio_agents.script_lines
  drop constraint if exists script_lines_video_generation_provider_check;

alter table kazika_studio_agents.script_lines
  add constraint script_lines_video_generation_provider_check
  check (video_generation_provider in ('grok', 'ltx_2_3_flf2v'));

update kazika_studio_agents.script_lines
set video_generation_provider = coalesce(
  nullif(metadata->>'video_generation_provider', ''),
  nullif(metadata->>'dialogue_video_generation_provider', ''),
  nullif(metadata#>>'{video_generation_settings,video_generation_provider}', ''),
  nullif(metadata#>>'{video_generation_settings,video_provider}', ''),
  'ltx_2_3_flf2v'
)
where coalesce(
  nullif(metadata->>'video_generation_provider', ''),
  nullif(metadata->>'dialogue_video_generation_provider', ''),
  nullif(metadata#>>'{video_generation_settings,video_generation_provider}', ''),
  nullif(metadata#>>'{video_generation_settings,video_provider}', '')
) in ('grok', 'ltx_2_3_flf2v')
   or video_generation_provider is null;

comment on column kazika_studio_agents.script_lines.video_generation_provider is
  'Primary script-line video generation provider/model. Valid values: grok, ltx_2_3_flf2v. Defaults to ltx_2_3_flf2v.';
