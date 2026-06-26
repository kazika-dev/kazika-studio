alter table agent_script_lines
  drop constraint if exists agent_script_lines_video_generation_provider_check;

alter table agent_script_lines
  add constraint agent_script_lines_video_generation_provider_check
  check (video_generation_provider in ('grok', 'ltx_2_3_i2v', 'ltx_2_3_flf2v', 'ltx_2_3_flf2v_lipsync'));

comment on column agent_script_lines.video_generation_provider is
  'Primary script-line video generation provider/model. Valid values: grok, ltx_2_3_i2v, ltx_2_3_flf2v, ltx_2_3_flf2v_lipsync. Defaults are enforced by line type trigger when null.';
