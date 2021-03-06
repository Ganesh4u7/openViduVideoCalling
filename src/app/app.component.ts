import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, HostListener, OnDestroy } from '@angular/core';
import { OpenVidu, Publisher, Session, StreamEvent, StreamManager, Subscriber } from 'openvidu-browser';
import { throwError as observableThrowError } from 'rxjs';
import { catchError } from 'rxjs/operators';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnDestroy { 

  OPENVIDU_SERVER_URL = 'https://ec2-13-127-86-183.ap-south-1.compute.amazonaws.com';
  OPENVIDU_SERVER_SECRET = 'MY_SECRET';

  // OpenVidu objects
  OV: OpenVidu;
  session: Session;
  publisher; // Local
  subscribers: StreamManager[] = []; // Remotes 

  // Join form
  mySessionId: string;
  myUserName: string;
  sessionPwd: string;
  confirmPwd: string;
  login = null;

  type: number = null;
  videoToggle = true;
  screenShareToggle = true;
  audioToggle = true;
  toggleRec = false;

  // Main video of the page, will be 'publisher' or one of the 'subscribers',
  // updated by click event in UserVideoComponent children
  mainStreamManager: StreamManager;

  constructor(private httpClient: HttpClient) {
    this.generateParticipantInfo();
  }

  @HostListener('window:beforeunload')
  beforeunloadHandler() {
    // On window closed leave session
    this.leaveSession();
  }

  ngOnDestroy() {
    // On component destroyed leave session
    this.leaveSession();
  }

  joinSession() {

    // --- 1) Get an OpenVidu object ---

    this.OV = new OpenVidu();

    // --- 2) Init a session ---

    this.session = this.OV.initSession();

    // --- 3) Specify the actions when events take place in the session ---

    // On every new Stream received...
    this.session.on('streamCreated', (event: StreamEvent) => {

      // Subscribe to the Stream to receive it. Second parameter is undefined
      // so OpenVidu doesn't create an HTML video by its own
      let subscriber: Subscriber = this.session.subscribe(event.stream, undefined);
      this.subscribers.push(subscriber);
      // console.log('_____________________');
      // console.log(this.subscribers);
      // console.log('_____________________');
    });

    // On every Stream destroyed...
    this.session.on('streamDestroyed', (event: StreamEvent) => {

      // Remove the stream from 'subscribers' array
      this.deleteSubscriber(event.stream.streamManager);
    });

    // --- 4) Connect to the session with a valid user token ---

    // 'getToken' method is simulating what your server-side should do.
    // 'token' parameter should be retrieved and returned by your own backend
    this.getToken().then(token => {

      // First param is the token got from OpenVidu Server. Second param can be retrieved by every user on event
      // 'streamCreated' (property Stream.connection.data), and will be appended to DOM as the user's nickname
      this.session.connect(token, { clientData: this.myUserName })
        .then(() => {

          // --- 5) Get your own camera stream ---

          // Init a publisher passing undefined as targetElement (we don't want OpenVidu to insert a video
          // element: we will manage it on our own) and with the desired properties
          let publisher: Publisher = this.OV.initPublisher(undefined, {
            audioSource: undefined, // The source of audio. If undefined default microphone
            videoSource: undefined, // The source of video. If undefined default webcam
            publishAudio: true,     // Whether you want to start publishing with your audio unmuted or not
            publishVideo: true,     // Whether you want to start publishing with your video enabled or not
            resolution: '640x480',  // The resolution of your video
            frameRate: 30,          // The frame rate of your video
            insertMode: 'APPEND',   // How the video is inserted in the target element 'video-container'
            mirror: false           // Whether to mirror your local video or not
          });

          // --- 6) Publish your stream ---
          

          this.session.publish(publisher);

          // Set the main video in the page to display our webcam and store our Publisher
          this.mainStreamManager = publisher;
          this.publisher = publisher;
        })
        .catch(error => {
          console.log('There was an error connecting to the session:', error.code, error.message);
        });
    });
  }

  leaveSession() {
    this.login = null;

    // --- 7) Leave the session by calling 'disconnect' method over the Session object ---

    if (this.session) { this.session.disconnect(); };

    // Empty all properties...
    this.subscribers = [];
    delete this.publisher; 
    delete this.session;
    delete this.OV;
    this.generateParticipantInfo();
  }


  private generateParticipantInfo() {
    // Random user nickname and sessionId
    this.mySessionId = 'SessionA';
    this.myUserName = 'Participant' + Math.floor(Math.random() * 100);
  }

  private deleteSubscriber(streamManager: StreamManager): void {
    let index = this.subscribers.indexOf(streamManager, 0);
    if (index > -1) {
      this.subscribers.splice(index, 1);
    }
  }

  updateMainStreamManager(streamManager: StreamManager) {
    this.mainStreamManager = streamManager;
  }


  /**
   * --------------------------
   * SERVER-SIDE RESPONSIBILITY
   * --------------------------
   * This method retrieve the mandatory user token from OpenVidu Server,
   * in this case making use Angular http API.
   * This behavior MUST BE IN YOUR SERVER-SIDE IN PRODUCTION. In this case:
   *   1) Initialize a session in OpenVidu Server	 (POST /api/sessions)
   *   2) Generate a token in OpenVidu Server		   (POST /api/tokens)
   *   3) The token must be consumed in Session.connect() method of OpenVidu Browser
   */

  getToken(): Promise<string> {
    return this.createSession(this.mySessionId).then(
      sessionId => {
       // sessionId = 'SessionA'
        return this.createToken(sessionId,this.sessionPwd);
      })
  }

  createSession(sessionId) {
    return new Promise((resolve, reject) => {

      const body = JSON.stringify({ customSessionId: sessionId });
      const options = {
        headers: new HttpHeaders({
          'Authorization': 'Basic ' + btoa('OPENVIDUAPP:' + this.OPENVIDU_SERVER_SECRET),
          'Content-Type': 'application/json'
        })
      };
      return this.httpClient.post(this.OPENVIDU_SERVER_URL + '/api/sessions', body, options)
        .pipe(
          catchError(error => {
            if (error.status === 409) {
              resolve(sessionId);
            } else {
              console.warn('No connection to OpenVidu Server. This may be a certificate error at ' + this.OPENVIDU_SERVER_URL);
              if (window.confirm('No connection to OpenVidu Server. This may be a certificate error at \"' + this.OPENVIDU_SERVER_URL +
                '\"\n\nClick OK to navigate and accept it. If no certificate warning is shown, then check that your OpenVidu Server' +
                'is up and running at "' + this.OPENVIDU_SERVER_URL + '"')) {
                location.assign(this.OPENVIDU_SERVER_URL + '/accept-certificate');
              }
            }
            return observableThrowError(error); 
          })
        )
        .subscribe(response => {
          console.log(response);
          // response = { id:'SessionA',createdAt:Timestamp}
          resolve(response['id']);
        });
    });
  }

  createToken(sessionId,sessionPwd): Promise<string> {
    return new Promise((resolve, reject) => {

      const body = { session: sessionId,sessionPwd:sessionPwd }; 
      const options = {
        headers: new HttpHeaders({
          'Authorization': 'Basic ' + btoa('OPENVIDUAPP:' + this.OPENVIDU_SERVER_SECRET),
          'Content-Type': 'application/json'
        })
      };
      if(this.type == 0){
      return this.httpClient.post('http://localhost:4300/create_session',body)
        .pipe(
          catchError(error => {
            reject(error);
            return observableThrowError(error);
          })
        )
        .subscribe((response:any) => { 
          console.log(response);
          let resData = response;
          if(resData.status == true){
            console.log('came here');
            this.login = true;
            resolve(response[0]);
          }
          else{ 
            this.login = false;
          }
          
          
        });
      }
      else if(this.type == 1){
        return this.httpClient.post('http://localhost:4300/join_session', body)
        .pipe(
          catchError(error => {
            reject(error);
            return observableThrowError(error);
          })
        )
        .subscribe((response:any) => {
          let resData = response;
          if(resData.status == true){
            console.log('came here');
            this.login = true;
            resolve(response[0]);
          }
          else{ 
            this.login = false;
          }
        });

      } 
    });
  }

  changeType(type){
    this.type = type;
    this.login = null;
  }

   videoOff(){
    if( this.videoToggle == true){
      this.publisher.publishVideo(false); 
    this.videoToggle = false;
    }
    else{
      this.publisher.publishVideo(true); 
      this.videoToggle = true;
    } 
  }
  
   screenShare(){
    if( this.screenShareToggle == true){
    // publisher.publishVideo(false);
    // console.log(this.publisher);
    this.session.unpublish(this.publisher);
    let publisher1: Publisher = this.OV.initPublisher(undefined, {
      audioSource: undefined, // The source of audio. If undefined default microphone
      videoSource: "screen", // The source of video. If undefined default webcam
      publishAudio: true,     // Whether you want to start publishing with your audio unmuted or not
      publishVideo: true,     // Whether you want to start publishing with your video enabled or not
      resolution: '640x480',  // The resolution of your video
      frameRate: 30,          // The frame rate of your video
      insertMode: 'APPEND',   // How the video is inserted in the target element 'video-container'
      mirror: false           // Whether to mirror your local video or not
    });
  
    //  this.publisher.replaceTrack(publisher1);
     this.session.publish(publisher1);
     this.publisher = publisher1;
     this.mainStreamManager = publisher1;
  
   this.screenShareToggle = false;
    }
    else{
      this.session.unpublish(this.publisher);
      let publisher1: Publisher = this.OV.initPublisher(undefined, {
        audioSource: undefined, // The source of audio. If undefined default microphone
        videoSource: undefined, // The source of video. If undefined default webcam
        publishAudio: true,     // Whether you want to start publishing with your audio unmuted or not
        publishVideo: true,     // Whether you want to start publishing with your video enabled or not
        resolution: '640x480',  // The resolution of your video
        frameRate: 30,          // The frame rate of your video
        insertMode: 'APPEND',   // How the video is inserted in the target element 'video-container'
        mirror: false           // Whether to mirror your local video or not
      });
      this.session.publish(publisher1);
      this.publisher = publisher1;
      this.mainStreamManager = publisher1;
      // var publisher = OV.initPublisher("video-container", { videoSource: undefined });
      this.screenShareToggle = true;
      this.videoToggle = true;
    } 
  }
   audioOff(){
    if( this.audioToggle == true){
    this.publisher.publishAudio(false);
    this.audioToggle = false;
    }
    else{
      this.publisher.publishAudio(true);
      this.audioToggle = true;
    } 
  }
   recordingSessionOn(){
  
    
  
      console.log('hello');
      var sessionId = this.mySessionId;
      console.log(sessionId);
  
    
      this.httpClient.post('http://localhost:4300/api-sessions/recording', {record:true,session:sessionId})
        .pipe(
          catchError(error => {
            return observableThrowError(error);
          })
        )
        .subscribe((response:any) => {
          console.log(response);
        if(this.toggleRec == true){
          this.toggleRec =false;
        }
        else{
          this.toggleRec = true
        }
        });
  
  }
   recordingSessionOff(){
  
    console.log('hello');
  
    
     this.httpClient.post('http://localhost:4300/api-sessions/recording', {record:false})
        .pipe(
          catchError(error => {
            return observableThrowError(error);
          })
        )
        .subscribe((response:any) => {
          console.log(response);
        if(this.toggleRec == true){
          this.toggleRec =false;
        }
        else{
          this.toggleRec = true
        }
        });
  
  }

}
