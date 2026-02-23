import React from 'react';
import { Grid, Box, Typography, Link } from '@mui/material';
import {
    Storage as StorageIcon, Security as SecurityIcon,
    Speed as SpeedIcon, Api as ApiIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const LoginFeatures = () => {
    const { t } = useTranslation();

    return (
        <Grid
            item
            xs={12}
            md={5}
            lg={6}
            sx={{
                display: { xs: 'none', md: 'flex' },
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundImage: 'url(/login-bg.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: '#fff',
                position: 'relative',
                overflow: 'hidden',
                p: 6,
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    zIndex: 0
                }
            }}
        >
            <Box sx={{ zIndex: 1, maxWidth: 480 }}>
                <Box display="flex" alignItems="center" mb={1}>
                    <StorageIcon sx={{ fontSize: 36, color: '#64ffda', mr: 2 }} />
                    <Typography variant="h4" fontWeight="800" letterSpacing={1}>
                        {t('login.title')}
                    </Typography>
                </Box>
                <Typography variant="h6" color="#8892b0" mb={3} fontWeight="300">
                    {t('login.subtitle')}
                </Typography>

                <Box display="flex" flexDirection="column" gap={2}>
                    <Box display="flex" alignItems="flex-start">
                        <SecurityIcon sx={{ color: '#64ffda', mr: 2, mt: 0.5 }} />
                        <Box>
                            <Typography variant="subtitle1" fontWeight="600">{t('login.feature2')}</Typography>
                            <Typography variant="body2" color="#8892b0">{t('login.feature2Desc')}</Typography>
                        </Box>
                    </Box>
                    <Box display="flex" alignItems="flex-start">
                        <ApiIcon sx={{ color: '#64ffda', mr: 2, mt: 0.5 }} />
                        <Box>
                            <Typography variant="subtitle1" fontWeight="600">{t('login.feature1')}</Typography>
                            <Typography variant="body2" color="#8892b0">{t('login.feature1Desc')}</Typography>
                        </Box>
                    </Box>
                    <Box display="flex" alignItems="flex-start">
                        <SpeedIcon sx={{ color: '#64ffda', mr: 2, mt: 0.5 }} />
                        <Box>
                            <Typography variant="subtitle1" fontWeight="600">AI-Powered Analytics</Typography>
                            <Typography variant="body2" color="#8892b0">Generate SQL queries instantly using advanced natural language processing.</Typography>
                        </Box>
                    </Box>
                </Box>
            </Box>

            <Box sx={{ position: 'absolute', bottom: 16, zIndex: 1, opacity: 0.8, display: 'flex', alignItems: 'center' }}>
                <Typography variant="caption">
                    &copy; {new Date().getFullYear()} {t('login.designedBy')} <Link href="https://binariaos.com.py" target="_blank" color="inherit" underline="hover">BinariaOS</Link> Technologies
                </Typography>
            </Box>
        </Grid>
    );
};

export default LoginFeatures;
