/**
 * PrintLabelsDialog.jsx - Generate printable plant pot labels
 *
 * Features:
 * - Avery-compatible label sizes (94208 small, 94200 large)
 * - Option to include QR codes linking to plant detail pages
 * - Option to include alias (Latin transliteration) and description
 * - Print-optimized CSS styling
 */
import { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Checkbox,
  Divider,
} from '@mui/material';
import { Print, Close, Download } from '@mui/icons-material';

// Label size configurations - Avery compatible
const LABEL_SIZES = {
  small: {
    name: 'Small - Avery 94208 (2/3" × 1-3/4")',
    width: '1.75in',
    height: '0.667in',
    fontSize: '8px',
    padding: '2px 4px',
    supportsQR: false,
    columns: 4, // 4 columns per row on Avery sheet
  },
  large: {
    name: 'Large - Avery 94200 (1" × 2-5/8")',
    width: '2.625in',
    height: '1in',
    fontSize: '10px',
    padding: '4px 6px',
    supportsQR: true,
    qrSize: 60, // pixels
    columns: 3, // 3 columns per row on Avery sheet
  },
};

// Base URL for QR codes
const PLANT_URL_BASE = 'https://violetteer.com/plant';

export default function PrintLabelsDialog({ open, onClose, plants }) {
  const [labelSize, setLabelSize] = useState('large');
  const [includeDescription, setIncludeDescription] = useState(false);
  const [includeAlias, setIncludeAlias] = useState(true);
  const [includeQrCode, setIncludeQrCode] = useState(false);
  const [qrCodes, setQrCodes] = useState({}); // Map of plant.id -> data URL
  const printRef = useRef(null);

  // Generate QR codes when dialog opens or plants change
  useEffect(() => {
    if (!open || !includeQrCode) return;

    const generateQRCodes = async () => {
      const codes = {};
      for (const plant of plants) {
        try {
          const url = `${PLANT_URL_BASE}/${plant.id}`;
          codes[plant.id] = await QRCode.toDataURL(url, {
            width: LABEL_SIZES.large.qrSize,
            margin: 1,
          });
        } catch (err) {
          console.error(`Failed to generate QR for plant ${plant.id}:`, err);
        }
      }
      setQrCodes(codes);
    };

    generateQRCodes();
  }, [open, plants, includeQrCode]);

  // Auto-select large size when QR code is enabled
  const handleQrCodeChange = (checked) => {
    setIncludeQrCode(checked);
    if (checked && labelSize === 'small') {
      setLabelSize('large');
    }
  };

  // Disable QR code when small size is selected
  const handleSizeChange = (size) => {
    setLabelSize(size);
    if (size === 'small' && includeQrCode) {
      setIncludeQrCode(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print labels');
      return;
    }

    const sizeConfig = LABEL_SIZES[labelSize];
    const qrSize = sizeConfig.qrSize || 60;
    const columns = sizeConfig.columns;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Plant Labels - ${plants.length} labels</title>
          <style>
            @page {
              size: letter;
              margin: 0.5in 0.25in;
            }

            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }

            body {
              font-family: Arial, sans-serif;
              background: white;
            }

            .labels-container {
              display: grid;
              grid-template-columns: repeat(${columns}, ${sizeConfig.width});
              gap: 0.125in;
              justify-content: center;
            }

            .label {
              width: ${sizeConfig.width};
              height: ${sizeConfig.height};
              border: 1px solid #333;
              border-radius: 4px;
              padding: ${sizeConfig.padding};
              font-size: ${sizeConfig.fontSize};
              display: flex;
              flex-direction: ${includeQrCode ? 'row' : 'column'};
              align-items: ${includeQrCode ? 'center' : 'stretch'};
              justify-content: ${includeQrCode ? 'flex-start' : 'center'};
              gap: ${includeQrCode ? '4px' : '0'};
              overflow: hidden;
              page-break-inside: avoid;
            }

            .qr-code {
              width: ${qrSize}px;
              height: ${qrSize}px;
              flex-shrink: 0;
            }

            .qr-code img {
              width: 100%;
              height: 100%;
            }

            .label-text {
              flex: 1;
              min-width: 0;
              overflow: hidden;
            }

            .plant-name {
              font-weight: bold;
              font-size: 1.1em;
              line-height: 1.2;
              margin-bottom: 2px;
              overflow: hidden;
              display: -webkit-box;
              -webkit-line-clamp: 1;
              -webkit-box-orient: vertical;
            }

            .plant-alias {
              font-size: 0.85em;
              color: #666;
              font-style: italic;
              margin-bottom: 2px;
              overflow: hidden;
              display: -webkit-box;
              -webkit-line-clamp: 1;
              -webkit-box-orient: vertical;
            }

            .plant-description {
              font-size: 0.8em;
              color: #444;
              line-height: 1.2;
              overflow: hidden;
              display: -webkit-box;
              -webkit-line-clamp: ${includeQrCode ? '2' : '3'};
              -webkit-box-orient: vertical;
            }

            @media print {
              .labels-container {
                gap: 0.1in;
              }
            }
          </style>
        </head>
        <body>
          <div class="labels-container">
            ${plants.map(plant => `
              <div class="label">
                ${includeQrCode && qrCodes[plant.id] ? `
                  <div class="qr-code">
                    <img src="${qrCodes[plant.id]}" alt="QR" />
                  </div>
                ` : ''}
                <div class="label-text">
                  <div class="plant-name">${escapeHtml(plant.name)}</div>
                  ${includeAlias && plant.alias ? `<div class="plant-alias">${escapeHtml(plant.alias)}</div>` : ''}
                  ${includeDescription && plant.description ? `<div class="plant-description">${escapeHtml(plant.description)}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  // Export plant data as CSV for use with Avery's label builder or Bluetooth printers
  const handleDownloadCSV = () => {
    const headers = ['name', 'alias', 'description', 'url'];
    const rows = plants.map(plant => [
      plant.name,
      plant.alias || '',
      plant.description || '',
      `${PLANT_URL_BASE}/${plant.id}`
    ]);

    // Build CSV content with proper escaping
    const escapeCSV = (value) => {
      if (!value) return '';
      // If value contains comma, quote, or newline, wrap in quotes and escape quotes
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plant-labels-${plants.length}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sizeConfig = LABEL_SIZES[labelSize];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Print />
          Print Labels ({plants.length} plants)
        </Box>
        <Button onClick={onClose} sx={{ minWidth: 0 }}>
          <Close />
        </Button>
      </DialogTitle>

      <DialogContent>
        {/* Options */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Label Size
          </Typography>
          <FormControl>
            <RadioGroup
              value={labelSize}
              onChange={(e) => handleSizeChange(e.target.value)}
            >
              {Object.entries(LABEL_SIZES).map(([key, config]) => (
                <FormControlLabel
                  key={key}
                  value={key}
                  control={<Radio size="small" />}
                  label={config.name}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Label Content
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeQrCode}
                onChange={(e) => handleQrCodeChange(e.target.checked)}
                size="small"
                disabled={labelSize === 'small'}
              />
            }
            label={
              <Box component="span">
                Include QR code (links to plant page)
                {labelSize === 'small' && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    — requires Large size
                  </Typography>
                )}
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={includeAlias}
                onChange={(e) => setIncludeAlias(e.target.checked)}
                size="small"
              />
            }
            label="Include alias (Latin transliteration)"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={includeDescription}
                onChange={(e) => setIncludeDescription(e.target.checked)}
                size="small"
              />
            }
            label="Include full description"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Preview */}
        <Typography variant="subtitle2" gutterBottom>
          Preview (first 3 labels)
        </Typography>
        <Box
          ref={printRef}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            p: 2,
            bgcolor: 'grey.100',
            borderRadius: 1,
          }}
        >
          {plants.slice(0, 3).map((plant) => (
            <Box
              key={plant.id}
              sx={{
                width: sizeConfig.width,
                height: sizeConfig.height,
                border: '1px solid',
                borderColor: 'grey.700',
                borderRadius: 1,
                p: sizeConfig.padding,
                fontSize: sizeConfig.fontSize,
                display: 'flex',
                flexDirection: includeQrCode ? 'row' : 'column',
                alignItems: includeQrCode ? 'center' : 'stretch',
                justifyContent: includeQrCode ? 'flex-start' : 'center',
                gap: includeQrCode ? 0.5 : 0,
                overflow: 'hidden',
                bgcolor: 'white',
              }}
            >
              {/* QR Code */}
              {includeQrCode && (
                <Box
                  sx={{
                    width: sizeConfig.qrSize,
                    height: sizeConfig.qrSize,
                    flexShrink: 0,
                  }}
                >
                  {qrCodes[plant.id] ? (
                    <img
                      src={qrCodes[plant.id]}
                      alt={`QR code for ${plant.name}`}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        bgcolor: 'grey.200',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '6px',
                      }}
                    >
                      QR
                    </Box>
                  )}
                </Box>
              )}

              {/* Text content */}
              <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <Typography
                  sx={{
                    fontWeight: 'bold',
                    fontSize: '1.1em',
                    lineHeight: 1.2,
                    mb: 0.25,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {plant.name}
                </Typography>
                {includeAlias && plant.alias && (
                  <Typography
                    sx={{
                      fontSize: '0.85em',
                      color: 'text.secondary',
                      fontStyle: 'italic',
                      mb: 0.25,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {plant.alias}
                  </Typography>
                )}
                {includeDescription && plant.description && (
                  <Typography
                    sx={{
                      fontSize: '0.8em',
                      color: 'text.secondary',
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: includeQrCode ? 2 : 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {plant.description}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
          {plants.length > 3 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
                fontSize: '0.875rem',
              }}
            >
              +{plants.length - 3} more
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={handleDownloadCSV}
        >
          Download CSV
        </Button>
        <Button
          variant="contained"
          startIcon={<Print />}
          onClick={handlePrint}
        >
          Print Labels
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Helper to escape HTML for safe insertion
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
