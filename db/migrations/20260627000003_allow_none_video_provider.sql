alter table kazika_studio_agents.script_lines
  drop constraint if exists script_lines_video_generation_provider_check;

alter table kazika_studio_agents.script_lines
  add constraint script_lines_video_generation_provider_check
  check (video_generation_provider in ('none', 'grok', 'ltx_2_3_i2v', 'ltx_2_3_flf2v', 'ltx_2_3_flf2v_lipsync', 'ltx_2_3_lipsync_fp8'));

comment on column kazika_studio_agents.script_lines.video_generation_provider is
  'Line-level video generation provider selected in Agent Scene UI: none, grok, ltx_2_3_i2v, ltx_2_3_flf2v, ltx_2_3_flf2v_lipsync, or ltx_2_3_lipsync_fp8.';
