import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { ContentCopy as ContentCopyIcon, Storage as DataIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const CrudContextMenu = ({ anchorEl, onClose, onCopyAsInsert, onCopyAsUpdate, onCopyWithHeaders }) => {
    const { t } = useTranslation();

    return (
        <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={onClose}
            elevation={3}
        >
            <MenuItem onClick={onCopyAsInsert}>
                <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('crud.copyInsert')}</ListItemText>
            </MenuItem>
            <MenuItem onClick={onCopyAsUpdate}>
                <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('crud.copyUpdate')}</ListItemText>
            </MenuItem>
            <MenuItem onClick={onCopyWithHeaders}>
                <ListItemIcon><DataIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('crud.copyTsv')}</ListItemText>
            </MenuItem>
        </Menu>
    );
};

export default CrudContextMenu;
