// PlantCard.jsx - Reusable plant card component
import { Card, CardContent, CardActionArea, CardMedia, Typography, Box, Chip, IconButton } from '@mui/material';
import { CheckCircle, Favorite, FavoriteBorder, Close, LocalFlorist } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function PlantCard({
  plant,
  isOwned,
  isWishlisted,
  onToggleOwned,
  onToggleWishlist,
  onRemove,
  showActions = true,
  showRemove = false,
  variant = 'card',
  verbose = false  // For listItem variant: show full description vs just name
}) {
  const navigate = useNavigate();

  const handleToggleOwned = (e) => {
    e.stopPropagation();
    if (onToggleOwned) onToggleOwned(plant.id);
  };

  const handleToggleWishlist = (e) => {
    e.stopPropagation();
    if (onToggleWishlist) onToggleWishlist(plant.id);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (onRemove) onRemove(plant.id);
  };

  /**
   * Get the description for display
   * Uses the pre-computed description from the database if available,
   * otherwise returns just the plant name as fallback.
   *
   * For card view (splitName=true), splits into { name, details }
   */
  const getDescription = (splitName = false) => {
    // Build name part with regNum
    let namePart = plant.name;
    if (plant.regNum) namePart += ` (${plant.regNum})`;

    if (splitName) {
      // For card view: return name and details separately
      // Extract details by removing the name part from the full description
      const fullDesc = plant.description || '';
      const nameWithReg = plant.regNum ? `${plant.name} (${plant.regNum})` : plant.name;
      let details = fullDesc.startsWith(nameWithReg)
        ? fullDesc.slice(nameWithReg.length).trim()
        : fullDesc.replace(plant.name, '').trim();

      return { name: namePart, details };
    }

    // For list view: return full description
    return plant.description || plant.name;
  };

  // List item view for mobile
  if (variant === 'listItem') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: verbose ? 'flex-start' : 'center',
          gap: 1.5,
          py: 1,
          px: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={() => navigate(`/plant/${plant.id}`)}
      >
        {/* Small thumbnail - use thumbnailUrl for faster loading */}
        {(plant.thumbnailUrl || plant.imageUrl) ? (
          <Box
            component="img"
            src={plant.thumbnailUrl || plant.imageUrl}
            alt={plant.name}
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1,
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1,
              bgcolor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LocalFlorist sx={{ fontSize: 24, color: 'grey.300' }} />
          </Box>
        )}

        {/* Plant info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {verbose ? (
            // Verbose: full description, wraps to multiple lines
            <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
              {getDescription()}
            </Typography>
          ) : (
            // Compact: just name, single line
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {plant.name}
            </Typography>
          )}
        </Box>

        {/* Quick action icons */}
        {showActions && (
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, alignSelf: 'center' }}>
            <IconButton
              size="small"
              onClick={handleToggleOwned}
              sx={{ p: 0.5 }}
            >
              <CheckCircle
                fontSize="small"
                sx={{ color: isOwned ? 'success.main' : 'action.disabled' }}
              />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleToggleWishlist}
              sx={{ p: 0.5 }}
            >
              {isWishlisted ? (
                <Favorite fontSize="small" sx={{ color: 'error.main' }} />
              ) : (
                <FavoriteBorder fontSize="small" sx={{ color: 'action.disabled' }} />
              )}
            </IconButton>
          </Box>
        )}

        {/* Remove button for list views */}
        {showRemove && (
          <IconButton size="small" onClick={handleRemove} sx={{ p: 0.5, alignSelf: 'center' }}>
            <Close fontSize="small" />
          </IconButton>
        )}
      </Box>
    );
  }

  // Card view (default)
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', maxWidth: 200 }}>
      {/* Status indicator */}
      {(isOwned || isWishlisted) && !showRemove && (
        <Chip 
          label={isOwned ? 'Owned' : 'Wishlist'} 
          color={isOwned ? 'success' : 'primary'}
          size="small"
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
        />
      )}

      {/* Remove button for collection/wishlist views */}
      {showRemove && (
        <IconButton
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'background.paper' }}
          size="small"
          onClick={handleRemove}
          title="Remove"
        >
          <Close />
        </IconButton>
      )}
      
      <CardActionArea onClick={() => navigate(`/plant/${plant.id}`)}>
        {/* Use thumbnailUrl for grid view - faster loading */}
        {(plant.thumbnailUrl || plant.imageUrl) ? (
          <CardMedia
            component="img"
            height="160"
            image={plant.thumbnailUrl || plant.imageUrl}
            alt={plant.name}
            sx={{ objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              height: 160,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'grey.100',
            }}
          >
            <LocalFlorist sx={{ fontSize: 48, color: 'grey.300' }} />
          </Box>
        )}
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 }, minWidth: 0, overflow: 'hidden' }}>
          {verbose ? (
            // Verbose: name prominent, details smaller and wrapping
            (() => {
              const { name, details } = getDescription(true);
              return (
                <>
                  <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
                    {name}
                  </Typography>
                  {details && (
                    <Box
                      component="p"
                      sx={{
                        typography: 'caption',
                        color: 'text.secondary',
                        lineHeight: 1.3,
                        mt: 0.5,
                        mb: 0,
                        maxHeight: '4.5em',
                        overflow: 'hidden',
                        wordBreak: 'break-word',
                      }}
                    >
                      {details}
                    </Box>
                  )}
                </>
              );
            })()
          ) : (
            // Compact: just name
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
              {plant.name}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>

      {/* Action buttons */}
      {showActions && (
        <Box sx={{ display: 'flex', justifyContent: 'space-around', py: 0.5, borderTop: 1, borderColor: 'divider' }}>
          <IconButton
            size="small"
            color={isOwned ? 'success' : 'default'}
            onClick={handleToggleOwned}
            title={isOwned ? 'Remove from collection' : 'Add to collection'}
          >
            <CheckCircle fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color={isWishlisted ? 'primary' : 'default'}
            onClick={handleToggleWishlist}
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            {isWishlisted ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
          </IconButton>
        </Box>
      )}
    </Card>
  );
}