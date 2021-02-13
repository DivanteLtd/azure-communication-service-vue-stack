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
            let token
            await axios.post('http://localhost:8000/get_access_token', state.auth.encrypted_auth ).then(result => {
                token = result.data
            });
            const callClient = new CallClient();    
            const tokenCredential = new AzureCommunicationTokenCredential(token);
            state.callAgent = await callClient.createCallAgent(tokenCredential);
            state.callAgent.on('incomingCall', async function({incomingCall}) {
                state.call.incoming = true;
                state.call.outgoing = false;
                state.incoming.callerId = incomingCall._callerIdentity.communicationUserId;
                state.call.current = incomingCall;
            });

            state.deviceManager = await callClient.getDeviceManager();
            state.outgoing.canCall = true;
        },
        userToCall: function (state, payload) {
            state.outgoing.userToCall = payload
        }
    },

    actions: {
        getAuthData: async function({ commit}) {
            if (!localStorage.getItem('auth-data-l')) {
                await axios.get('http://localhost:8000/issue_access_token').then(result => {
                  localStorage.setItem('auth-data-l', JSON.stringify(result.data));
                });
            }
            commit('setAuthData', JSON.parse(localStorage.getItem('auth-data-l')));
        },
        startCall: function({ commit, state, dispatch}) {
            const videoDeviceInfo = state.deviceManager.getCameraList()[0];
            const localVideoStream = new LocalVideoStream(videoDeviceInfo);
            const callOptions = {videoOptions: {localVideoStreams:[localVideoStream]}};

            state.call.current = state.callAgent.call(
                [{ communicationUserId: state.outgoing.userToCall }],
                callOptions
            );
            state.call.current.on('callEnded', async function(callEndReason) {
                state.call.outgoing = true;
                state.call.incoming = false;
                state.call.showVideo = false;
                state.outgoing.canCall = true;
                state.outgoing.canHangUp = false;
                state.call.inProgress = true;
            });

            state.call.outgoing = true;
            state.outgoing.canCall = false;
            state.outgoing.canHangUp = true;

            dispatch('showVideo')
        },
        hangUp: function({ commit, state}) {
            state.call.current.hangUp({ forEveryone: true });
            state.outgoing.canCall = true;
            state.outgoing.canHangUp = false;
            state.call.showVideo = false;
            state.call.inProgress = false;

            const videoElement = document.getElementById('video')
            videoElement.innerHTML = '';
        },
        acceptCall: async function({ commit, state, dispatch}) {
            const videoDeviceInfo = state.deviceManager.getCameraList()[0];
            const localVideoStream = new LocalVideoStream(videoDeviceInfo);
            const callOptions = {videoOptions: {localVideoStreams:[localVideoStream]}};

            state.call.current = await state.call.current.accept(callOptions);
            state.call.current.on('callEnded', async function(callEndReason) {
                state.call.outgoing = true;
                state.call.incoming = false;
                state.call.showVideo = false;
                state.outgoing.canCall = true;
                state.outgoing.canHangUp = false;
                state.call.inProgress = true;
            });
            dispatch('showVideo')
        },
        declineCall: function({ commit, state}) {
            if (state.call.inProgress) {
                state.call.inProgress = false;
                state.call.current.hangUp({ forEveryone: true });
            } else {
                state.call.current.reject();
            }
            state.call.outgoing = true;
            state.call.incoming = false;
            state.call.showVideo = false;
            state.outgoing.canCall = true;
            state.outgoing.canHangUp = false;
        },
        showVideo: async function({ commit, state}) {
            state.call.inProgress = true;
            state.call.showVideo = true;
            const stream = state.call.current.remoteParticipants[0].videoStreams[0];
            const renderer = new Renderer(stream);
            const view = await renderer.createView();
            
            const videoElement = document.getElementById('video');
            videoElement.appendChild(view.target);
        }
    }
})

export default store
