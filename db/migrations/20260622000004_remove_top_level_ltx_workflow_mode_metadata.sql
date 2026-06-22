-- Remove the remaining top-level LTX workflow selector from script-line metadata.
-- Provider/model selection belongs in script_lines.video_generation_provider.
-- Keep generation history keys such as ltx_video_generated_at/job_id.

update kazika_studio_agents.script_lines
set metadata = metadata - 'ltx_workflow_mode',
    updated_at = now()
where metadata ? 'ltx_workflow_mode';
