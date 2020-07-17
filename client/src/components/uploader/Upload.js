import React, { Component } from "react";
import Dropzone from "./Dropzone";
import "./Upload.css";
import Progress from "./Progress";
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoIdToken } from 'amazon-cognito-identity-js';
import axios from 'axios';
import { stringLiteral } from "@babel/types";
const UserPoolId = 'us-east-1_Nyqobq2qH';
const ClientId = '34524dvl31gse4v09bnejt0499';
const ApiGatewayUrl = 'https://i36ip33cnh.execute-api.us-east-1.amazonaws.com/production/';


const userPool = new CognitoUserPool({
  UserPoolId: UserPoolId,
  ClientId: ClientId,
});


class Upload extends Component {
  constructor(props) {
    super(props);
    this.state = {
      files: [],
      uploading: false,
      uploadProgress: {},
      successfullUploaded: false,
      //username: '',
      //password: '',
      accessToken: '',
      isAuthenticated: true,
      //isLoginFailed: false,
    };

    this.onFilesAdded = this.onFilesAdded.bind(this);
    this.uploadFiles = this.uploadFiles.bind(this);
    this.sendRequest = this.sendRequest.bind(this);
    this.renderActions = this.renderActions.bind(this);
  }

  onFilesAdded(files) {
    this.setState(prevState => ({
      files: prevState.files.concat(files)
    }));
  }

  async uploadFiles() {
    this.setState({ uploadProgress: {}, uploading: true });
    const promises = [];
    this.state.files.forEach(file => {
      promises.push(this.sendRequest(file));
    });
    try {
      await Promise.all(promises);

      this.setState({ successfullUploaded: true, uploading: false });
    } catch (e) {
      // Not Production ready! Do some error handling here instead...
      this.setState({ successfullUploaded: true, uploading: false });
    }
  }

  sendRequest(file) {
    return new Promise((resolve, reject) => {
      console.log('onDrop' + file)
      // first get the pre-signed URL

      //this.state.accessToken = 
      let data = {
        'name': file.name
      }
      console.log('access token - ' + this.state.accessToken)
      axios.post(ApiGatewayUrl, data,
          {headers: {Authorization: this.state.accessToken}}).then((response) => {
          // now do a PUT request to the pre-signed URL
          console.log('Presigned URL' + response.data)
          const options = {
            headers: {
              "Content-Type": "multipart/form-data",
            },
            onUploadProgress: (progressEvent) => {
              console.log(progressEvent.loaded)
              console.log(progressEvent.total)
              if (progressEvent.lengthComputable) {
                  const copy = { ...this.state.uploadProgress };
                  copy[file.name] = {
                    state: "pending",
                    percentage: (progressEvent.loaded / progressEvent.total) * 100
                  };
                  this.setState({ uploadProgress: copy });
                }
            },
          };
        const signed_url = response.data
          axios.put(signed_url, file, options)
              .then((response) => {
                const copy = { ...this.state.uploadProgress };
                 copy[file.name] = { state: "done", percentage: 100 };
                 this.setState({ uploadProgress: copy });
                resolve(response);
              });
      });
    })
  }

  renderProgress(file) {
    const uploadProgress = this.state.uploadProgress[file.name];
    if (this.state.uploading || this.state.successfullUploaded) {
      return (
        <div className="ProgressWrapper">
          <Progress progress={uploadProgress ? uploadProgress.percentage : 0} />
          <img
            className="CheckIcon"
            alt="done"
            src="baseline-check_circle_outline-24px.svg"
            style={{
              opacity:
                uploadProgress && uploadProgress.state === "done" ? 0.5 : 0
            }}
          />
        </div>
      );
    }
  }

  renderActions() {

    if (this.state.successfullUploaded) {
      return (
        <button
          onClick={() =>
            this.setState({ files: [], successfullUploaded: false })
          }
        >
          Clear
        </button>
      );
    } else {
      return (
        <button
          disabled={this.state.files.length < 0 || this.state.uploading}
          onClick={this.uploadFiles}
        >
          Upload
        </button>
      );
    }
  }

  // is used by both login and password reset
  // onSuccess = (result) => {
  //   console.log("onSuccess");
  //   console.log(result);
  //   this.setState({
  //     accessToken: result.idToken.jwtToken, // the token used for subsequent, authorized requests
  //     isAuthenticated: true,
  //     isLoginFailed: false,
  //   });
  // };

  // // is used by both login and password reset
  // onFailure = (error) => {
  //   console.log("onFailure");
  //   console.log(error);
  //   this.setState({
  //     isAuthenticated: false,
  //     isLoginFailed: true,
  //     statusCode: '',
  //   });
  // };

  // onSubmit = (event) => {
  //   event.preventDefault();

  //   let cognitoUser = new CognitoUser({
  //     Username: this.state.username,
  //     Pool: userPool,
  //   });

  //   const authenticationDetails = new AuthenticationDetails({
  //     Username: this.state.username,
  //     Password: this.state.password,
  //   });

  //   cognitoUser.authenticateUser(authenticationDetails, {
  //     onSuccess: this.onSuccess,
  //     onFailure: this.onFailure,
  //     newPasswordRequired: (userAttributes, requiredAttributes) => {
  //       console.log("newPasswordRequired");
  //       console.log(userAttributes);

  //       // not interesting for this demo - add a bogus e-mail and append an X to the initial password
  //       userAttributes['email'] = 'robinson@example.com';
  //       cognitoUser.completeNewPasswordChallenge(this.state.password + 'X', {}, this);
  //     },
  //   });
  // };

  render() {
    return (
      <div className="Upload">
        {/* <span className="Title">Upload Files</span> */}
        {/* <form onSubmit={this.onSubmit}>
          <input type='text' value={this.state.username} onChange={(event) => this.setState({username: event.target.value})} placeholder='username' /><br />
          <input type='password' value={this.state.password} onChange={(event) => this.setState({password: event.target.value})} placeholder='password' /><br />
          <input type='submit' value='Login' />
        </form> */}
        <div className="Content">
          <div>
            <Dropzone
              onFilesAdded={this.onFilesAdded}
              disabled={this.state.uploading || this.state.successfullUploaded}
            />
          </div>
          <div className="Files">
            {this.state.files.map(file => {
              return (
                <div key={file.name} className="Row">
                  <span className="Filename">{file.name}</span>
                  {this.renderProgress(file)}
                </div>
              );
            })}
          </div>
        </div>
        <div className="Actions">{this.renderActions()}</div>
      </div>
    );
  }
}

export default Upload;
