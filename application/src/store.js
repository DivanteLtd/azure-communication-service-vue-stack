import Vuex from 'vuex'
import axios from 'axios'
import { CallClient, LocalVideoStream, Renderer } from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";

const store = new Vuex.Store({
    state: {
        auth: {},
        callAgent: {},
        deviceManager: {},
        outgoing: {
            userToCall: "",
            canCall: false,
            canHangUp: false
        },
        incoming: {
            callerId: "",
            canAccept: true,
            canDecline: false
        },
        call: {
            current: {},
            incoming: false,
            outgoing: true,
            showVideo: false,
            inProgress: false
        }
    },

    getters: {
        getAuthData: state => {
            return state.auth
        },
        getOutgoing: state => {
            return state.outgoing
        }
    },

    mutations: {
        setAuthData: async function(state, payload) {
            state.auth = payload;
        },
        setPrerequisites: function(state, payload) {
            state.callAgent = payload.callAgent;
            state.deviceManager = payload.deviceManager;
            state.outgoing.canCall = true;
        },
        userToCall: function (state, payload) {
            state.outgoing.userToCall = payload
        },
        setIncomingContext: function (state, payload) {
            state.call.incoming = true;
            state.call.outgoing = false;
            state.incoming.callerId = payload._callerIdentity.communicationUserId;
            state.call.current = payload;
        },
        setOutgoingContext: function (state) {
            state.call.outgoing = true;
            state.call.incoming = false;
            state.call.showVideo = false;
            state.call.inProgress = true;
        },
        canCall: function (state, payload) {
            state.outgoing.canCall = payload;
            state.outgoing.canHangUp = !payload;
        },
        callInProgress: function (state, payload) {
            state.call.inProgress = payload;
        },
        setCall: function (state, payload) {
            state.call.current = payload;
        },
        setVideo: function (state, payload) {
            state.call.showVideo = payload;
        },
        hideVideo: function (state) {
            const videoElement = document.getElementById('video')
            videoElement.innerHTML = '';
            state.call.showVideo = false;
        }
    },

    actions: {
        getAuthData: async function({ commit, dispatch }) {
            if (!localStorage.getItem('auth-data')) {
                await axios.get('/endpoint/issue_access_token').then(async function(result) {
                    localStorage.setItem('auth-data', JSON.stringify(result.data));
                    commit('setAuthData', result.data);
                    dispatch("initPrerequisites", result.data)
                });
            } else {
                dispatch("initPrerequisites", JSON.parse(localStorage.getItem('auth-data')))
            }
        },
        initPrerequisites: async function({ commit, state}, payload) {
            commit('setAuthData', payload);
            let token
            await axios.post('/endpoint/get_access_token', payload.encrypted_auth ).then(result => {
                token = result.data
            });
            const callClient = new CallClient();    
            const tokenCredential = new AzureCommunicationTokenCredential(token);
            const callAgent = await callClient.createCallAgent(tokenCredential);
            callAgent.on('incomingCall', async function({incomingCall}) {
                commit('setIncomingContext', incomingCall);
            });
            const deviceManager = await callClient.getDeviceManager();
            commit('setPrerequisites', {callAgent: callAgent, deviceManager: deviceManager});
        },
        startCall: function({ commit, state, dispatch}) {
            const videoDeviceInfo = state.deviceManager.getCameraList()[0];
            const localVideoStream = new LocalVideoStream(videoDeviceInfo);
            const callOptions = {videoOptions: {localVideoStreams:[localVideoStream]}};

            const call = state.callAgent.call(
                [{ communicationUserId: state.outgoing.userToCall }],
                callOptions
            );
            call.on('callEnded', async function(callEndReason) {
                commit('setOutgoingContext');
                commit('canCall', true)
                commit('callInProgress', false);
                commit('hideVideo')
            });
            commit('callInProgress', true);
            commit("setCall", call)
            commit('setOutgoingContext');
            commit('canCall', false)
            dispatch('showVideo')
        },
        hangUp: function({ commit, state, dispatch }) {
            state.call.current.hangUp({ forEveryone: true });
            commit("setCall", call)
            commit('setOutgoingContext');
            commit('hideVideo')
        },
        acceptCall: async function({ commit, state, dispatch}) {
            const videoDeviceInfo = state.deviceManager.getCameraList()[0];
            const localVideoStream = new LocalVideoStream(videoDeviceInfo);
            const callOptions = {videoOptions: {localVideoStreams:[localVideoStream]}};

            const call = await state.call.current.accept(callOptions);
            call.on('callEnded', function(callEndReason) {
                commit('setOutgoingContext');
                commit('callInProgress', false);
                commit('canCall', true)
                commit('hideVideo')
            });
            commit('callInProgress', true);
            commit("setCall", call)
            dispatch('showVideo')
        },
        declineCall: function({ commit, state, dispatch }) {
            if (state.call.inProgress) {
                state.call.current.hangUp({ forEveryone: true });
                commit('callInProgress', false);
            } else {
                state.call.current.reject();
            }
            commit("setCall", {})
            commit('setOutgoingContext');
            commit('canCall', true)
            commit('hideVideo')
        },
        showVideo: async function({ commit, state}) {
            const stream = state.call.current.remoteParticipants[0].videoStreams[0];
            const renderer = new Renderer(stream);
            const view = await renderer.createView();

            commit("setVideo", true)
            const videoElement = document.getElementById('video');
            videoElement.appendChild(view.target);
        }
    }
})

export default store
