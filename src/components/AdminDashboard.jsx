/**
 * AdminDashboard.jsx - Admin-only dashboard with statistics
 *
 * Displays:
 * - Summary stats cards (users, collected plants, etc.)
 * - Pie chart of most popular blossom colors in collections
 *
 * Protected: Only accessible to users with isAdmin: true
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  CircularProgress,
  Button,
  Alert,
} from '@mui/material';
import {
  People,
  LocalFlorist,
  Collections,
  Refresh,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate('/');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  // Fetch stats on mount
  useEffect(() => {
    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('http://localhost:3001/api/admin/stats', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      // Clear cache first
      await fetch('http://localhost:3001/api/admin/stats/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      // Then fetch fresh data
      await fetchStats();
    } finally {
      setRefreshing(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  // Don't render for non-admins (redirect will happen)
  if (!isAdmin) {
    return null;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Admin Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={refreshing ? <CircularProgress size={20} /> : <Refresh />}
          onClick={handleRefresh}
          disabled={refreshing || loading}
        >
          Refresh Stats
        </Button>
      </Box>

      {/* Cache indicator */}
      {stats?.cached && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Showing cached data from {new Date(stats.cachedAt).toLocaleString()}.
          Click Refresh to update.
        </Alert>
      )}

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading state */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }} color="text.secondary">
            Loading statistics...
          </Typography>
        </Box>
      ) : stats ? (
        <>
          {/* Stats Overview Card - contains stats and charts */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Statistics Overview
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <People sx={{ fontSize: 32, color: 'primary.main', mb: 0.5 }} />
                  <Typography variant="h5">{stats.totalUsers.toLocaleString()}</Typography>
                  <Typography variant="body2" color="text.secondary">Registered Users</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <LocalFlorist sx={{ fontSize: 32, color: 'success.main', mb: 0.5 }} />
                  <Typography variant="h5">{stats.totalCatalogPlants.toLocaleString()}</Typography>
                  <Typography variant="body2" color="text.secondary">Catalog Varieties</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Collections sx={{ fontSize: 32, color: 'secondary.main', mb: 0.5 }} />
                  <Typography variant="h5">{stats.totalCollectedPlants.toLocaleString()}</Typography>
                  <Typography variant="body2" color="text.secondary">Plants in Collections</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #FF69B4, #9370DB, #4169E1)',
                      mx: 'auto',
                      mb: 0.5,
                    }}
                  />
                  <Typography variant="h5">{stats.colorStats.length}</Typography>
                  <Typography variant="body2" color="text.secondary">Color Categories</Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Charts Row - side by side */}
            <Box sx={{ display: 'flex', gap: 3, borderTop: '1px solid', borderColor: 'divider', pt: 3 }}>
              {/* Color Popularity Pie Chart - grows to fill available space */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h6" gutterBottom>
                    Blossom Colors in Collections
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Distribution of flower colors in user collections
                  </Typography>

                {stats.colorStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <Pie
                        data={stats.colorStats}
                        dataKey="count"
                        nameKey="displayName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ cx, cy, midAngle, outerRadius, displayName, percent }) => {
                          const RADIAN = Math.PI / 180;
                          const radius = outerRadius + 25;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text
                              x={x}
                              y={y}
                              fill="#333"
                              textAnchor={x > cx ? 'start' : 'end'}
                              dominantBaseline="central"
                              fontSize={12}
                            >
                              {`${displayName} (${(percent * 100).toFixed(0)}%)`}
                            </text>
                          );
                        }}
                        labelLine={{ stroke: '#666' }}
                      >
                        {stats.colorStats.map((entry, index) => {
                          const isLightColor = entry.name === 'white' || entry.color === '#FFFFFF';
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color || '#8884d8'}
                              stroke={isLightColor ? '#ccc' : '#fff'}
                              strokeWidth={2}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [`${value} plants`, name]}
                        contentStyle={{ fontSize: 12, padding: '4px 8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography color="text.secondary">
                      No collection data yet.
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Collection Index Bar Chart */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" gutterBottom>
                  Collection Index by Color
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Above 1.0 = over-collected; below 1.0 = under-collected
                </Typography>

                {stats.colorStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={stats.colorStats
                        .filter((c) => c.collectionIndex > 0)
                        .sort((a, b) => b.collectionIndex - a.collectionIndex)}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        domain={[0, 'auto']}
                        tickFormatter={(value) => value.toFixed(1)}
                      />
                      <YAxis
                        type="category"
                        dataKey="displayName"
                        width={70}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value, name, props) => {
                          const item = props.payload;
                          return [
                            `${value.toFixed(2)}x (${item.collectionPct}% collected vs ${item.catalogPct}% available)`,
                            'Index',
                          ];
                        }}
                        contentStyle={{ fontSize: 12, padding: '4px 8px' }}
                      />
                      <ReferenceLine x={1} stroke="#666" strokeDasharray="3 3" />
                      <Bar dataKey="collectionIndex" name="Collection Index">
                        {stats.colorStats
                          .filter((c) => c.collectionIndex > 0)
                          .sort((a, b) => b.collectionIndex - a.collectionIndex)
                          .map((entry, index) => (
                            <Cell
                              key={`bar-${index}`}
                              fill={entry.color || '#8884d8'}
                              stroke={entry.name === 'white' || entry.color === '#FFFFFF' ? '#ccc' : undefined}
                              strokeWidth={entry.name === 'white' || entry.color === '#FFFFFF' ? 1 : 0}
                            />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography color="text.secondary">
                      Not enough data to calculate collection index.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
        </>
      ) : null}
    </Container>
  );
}
