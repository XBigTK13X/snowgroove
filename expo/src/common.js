import React from 'react'

import {
    AppState,
    Linking,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    TVEventHandler,
    TVFocusGuideView,
    View,
} from 'react-native'

import { useKeepAwake } from 'expo-keep-awake';

import { useDebouncedCallback } from 'use-debounce';

import util from './util'

import Snow, {
    Image,
    SnowBreak,
    SnowDropdown,
    SnowFillView,
    SnowGrid,
    SnowHeader,
    SnowImageButton,
    SnowImageGrid,
    SnowInput,
    SnowLabel,
    SnowOverlay,
    SnowRangeSlider,
    SnowTabs,
    SnowTarget,
    SnowText,
    SnowTextButton,
    SnowToggle,
    SnowView,
    useSnowContext
} from 'expo-snowui'

import SnowCreateJobButton from './comp/snow-create-job-button'
import SnowDraggableColumn from './comp/snow-draggable-column'
import SnowPosterGrid from './comp/snow-poster-grid'
import SnowScreencapGrid from './comp/snow-screencap-grid'

const isAndroid = Platform.OS === 'android'
const isTV = Platform.isTV
const isWeb = Platform.OS === 'web'

export default {
    isAndroid,
    isTV,
    isWeb,
    useDebouncedCallback,
    useKeepAwake,
    useSnowContext,
    util,
    AppState,
    FillView: SnowFillView,
    Image,
    Linking,
    Platform,
    React,
    ScrollView,
    Snow,
    SnowBreak,
    SnowCreateJobButton,
    SnowDraggableColumn,
    SnowDropdown,
    SnowGrid,
    SnowHeader,
    SnowImageButton,
    SnowImageGrid,
    SnowInput,
    SnowLabel,
    SnowOverlay,
    SnowPosterGrid,
    SnowRangeSlider,
    SnowScreencapGrid,
    SnowTabs,
    SnowTarget,
    SnowText,
    SnowTextButton,
    SnowToggle,
    SnowView,
    Text,
    TouchableOpacity,
    TVEventHandler,
    TVFocusGuideView,
    View,
}
