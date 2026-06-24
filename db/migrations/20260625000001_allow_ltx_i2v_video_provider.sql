-- Allow selecting the RunPod LTX 2.3 image-to-video workflow per script line.

alter table kazika_studio_agents.script_lines
  drop constraint if exists script_lines_video_generation_provider_check;

alter table kazika_studio_agents.script_lines
  add constraint script_lines_video_generation_provider_check
  check (video_generation_provider in ('grok', 'ltx_2_3_i2v', 'ltx_2_3_flf2v'));

comment on column kazika_studio_agents.script_lines.video_generation_provider is
  'Primary script-line video generation provider/model. Valid values: grok, ltx_2_3_i2v, ltx_2_3_flf2v. Defaults are enforced by line type trigger when null.';
