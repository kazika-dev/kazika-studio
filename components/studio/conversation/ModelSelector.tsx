'use client';

import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Chip,
  SelectChangeEvent
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { CONVERSATION_MODEL_OPTIONS, type ConversationModel } from '@/lib/vertex-ai/constants';

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

/**
 * Get provider chip for visual distinction
 */
function getProviderChip(provider: string) {
  switch (provider) {
    case 'anthropic':
      return <Chip size="small" label="Anthropic" color="warning" sx={{ ml: 1 }} />;
    case 'vertex-gemini':
      return <Chip size="small" label="Vertex AI" color="primary" sx={{ ml: 1 }} />;
    case 'google-genai':
    default:
      return <Chip size="small" label="API" color="default" sx={{ ml: 1 }} />;
  }
}

/**
 * Model selector component for conversation generation
 * Supports Gemini (via Vertex AI), Claude (via Vertex AI Model Garden), and fallback API
 */
export default function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value);
  };

  return (
    <FormControl fullWidth disabled={disabled}>
      <InputLabel id="model-selector-label">AIモデル</InputLabel>
      <Select
        labelId="model-selector-label"
        value={value}
        onChange={handleChange}
        label="AIモデル"
        startAdornment={<SmartToyIcon sx={{ mr: 1, color: 'action.active' }} />}
      >
        {CONVERSATION_MODEL_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Typography sx={{ flex: 1 }}>{option.label}</Typography>
              {getProviderChip(option.provider)}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
