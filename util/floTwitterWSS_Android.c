#include "mongoose.h"
static sig_atomic_t s_signal_received = 0;
static const char *s_http_port = "3232";
static struct mg_serve_http_opts s_http_server_opts;
static char serverpass[100];
static struct mg_connection *selfClient = NULL;

struct tweetData{
  int id;
  char data[5000];
};

struct followData{
  char floID[35];
  char sign[150];
};

static void signal_handler(int sig_num) {
  signal(sig_num, signal_handler);  // Reinstantiate signal handler
  s_signal_received = sig_num;
}

static int is_websocket(const struct mg_connection *nc) {
  return nc->flags & MG_F_IS_WEBSOCKET;
}

static void broadcast(struct mg_connection *nc, const struct mg_str msg) {
  struct mg_connection *c;
  char buf[5000];

  snprintf(buf, sizeof(buf), "%.*s", (int) msg.len, msg.p);
  printf("%s\n", buf); /* Local echo. */
  for (c = mg_next(nc->mgr, NULL); c != NULL; c = mg_next(nc->mgr, c)) {
    if (c == nc) continue; /* Don't send to the sender. */
    mg_send_websocket_frame(c, WEBSOCKET_OP_TEXT, buf, strlen(buf));
  }
}

static void unicast(struct mg_connection *nc,const struct mg_str msg) {
  char buf[5000];

  snprintf(buf, sizeof(buf), "%.*s", (int) msg.len, msg.p);
  printf("%s\n", buf); /* Local echo. */
  if(nc != NULL)
    mg_send_websocket_frame(nc, WEBSOCKET_OP_TEXT, buf, strlen(buf));
  else
    printf("No selfClient is connected!\n");
  
}

static void storeTweet(struct mg_connection *nc,const struct mg_str msg){
  struct tweetData tweet;
  snprintf(tweet.data, sizeof(tweet.data), "%.*s", (int) msg.len, msg.p);
  FILE *fptr;
  fptr = fopen("/storage/emulated/0/FLO_Twitter/tweet.bin","ab");
  if(fptr == NULL){
    printf("Error in opening tweet.bin\n");
    return;
  }
  fseek(fptr,0,SEEK_END);
  long int filesize = ftell(fptr);
  tweet.id = filesize/sizeof(tweet) + 1;
  fwrite(&tweet,sizeof(tweet),1,fptr);
  fclose(fptr);
  //broadcast
  struct mg_connection *c;
  char buf[5050];
  snprintf(buf, sizeof(buf), "{\"id\":%d,\"data\":%s}", tweet.id, tweet.data);
  printf("%s\n", buf); /* Local echo. */
  for (c = mg_next(nc->mgr, NULL); c != NULL; c = mg_next(nc->mgr, c)) {
    if (c == nc) continue; /* Don't send to the sender. */
    mg_send_websocket_frame(c, WEBSOCKET_OP_TEXT, buf, strlen(buf));
  }
}

static void sendTweets(struct mg_connection *nc, const struct mg_str d){
  int i, n = 0;
  for(i=1; i < d.len; i++)
    n = (n*10) + (d.p[i] - '0');
  //printf("%d\n",n);
  struct tweetData tweet;
  char buf[5050];
  FILE *fptr;
  fptr = fopen("/storage/emulated/0/FLO_Twitter/tweet.bin","rb");
  if(fptr == NULL){
    printf("Error in opening tweet.bin\n");
    return;
  }
  fseek(fptr, n*sizeof(tweet), SEEK_SET);
  while(fread(&tweet,sizeof(tweet),1,fptr)){
    snprintf(buf, sizeof(buf), "{\"id\":%d,\"data\":%s}", tweet.id, tweet.data);
    printf("%s\n", buf);
    mg_send_websocket_frame(nc, WEBSOCKET_OP_TEXT, buf, strlen(buf));
  }
  fclose(fptr);
}

static void Follower(const struct mg_str d){
  struct followData data;
  snprintf(data.floID, sizeof(data.floID), "%.*s", (int) (34), &d.p[1]);
  snprintf(data.sign, sizeof(data.sign), "%.*s", (int) (d.len-36), &d.p[36]);
  printf("Follower : %s\n",data.floID);
  FILE *fptr;
  fptr = fopen("/storage/emulated/0/FLO_Twitter/followers.bin","ab");
  if(fptr == NULL){
    printf("Error in opening followers.bin\n");
    return;
  }
  fseek(fptr,0,SEEK_END);
  fwrite(&data,sizeof(data),1,fptr);
  fclose(fptr);
}

static void Unfollower(const struct mg_str d){
  char floID[35];
  struct followData data;
  snprintf(floID, sizeof(floID), "%.*s", (int) (34), &d.p[1]);
  printf("Unfollower : %s\n",floID);
  FILE *fp;
  FILE *fp_tmp;
  fp = fopen("/storage/emulated/0/FLO_Twitter/followers.bin", "rb");
  if (!fp) {
    printf("Error in opening followers.bin\n");
    return;
  }
  fp_tmp = fopen("/storage/emulated/0/FLO_Twitter/tmp.bin", "wb");
  if (!fp) {
    printf("Error in opening tmp.bin\n");
    return;
  }
  while(fread(&data,sizeof(data),1,fp)){
    if(strcmp(data.floID,floID)) //floID != follower.floID
      fwrite(&data,sizeof(data),1,fp_tmp);
  }
  fclose(fp);
  fclose(fp_tmp);
  remove("/storage/emulated/0/FLO_Twitter/followers.bin");
  rename("/storage/emulated/0/FLO_Twitter/tmp.bin", "followers.bin");
  return;
}

static void follow(const struct mg_str d){
  struct followData data;
  snprintf(data.floID, sizeof(data.floID), "%.*s", (int) (34), &d.p[1]);
  snprintf(data.sign, sizeof(data.sign), "%.*s", (int) (d.len-36), &d.p[36]);
  printf("follow : %s\n",data.floID);
  FILE *fptr;
  fptr = fopen("/storage/emulated/0/FLO_Twitter/following.bin","ab");
  if(fptr == NULL){
    printf("Error in opening following.bin\n");
    return;
  }
  fseek(fptr,0,SEEK_END);
  fwrite(&data,sizeof(data),1,fptr);
  fclose(fptr);
}

static void unfollow(const struct mg_str d){
  char floID[35];
  struct followData data;
  snprintf(floID, sizeof(floID), "%.*s", (int) (34), &d.p[1]);
  printf("unfollow : %s\n",floID);
  FILE *fp;
  FILE *fp_tmp;
  fp = fopen("/storage/emulated/0/FLO_Twitter/following.bin", "rb");
  if (!fp) {
    printf("Error in opening following.bin\n");
    return;
  }
  fp_tmp = fopen("/storage/emulated/0/FLO_Twitter/tmp.bin", "wb");
  if (!fp) {
    printf("Error in opening tmp.bin\n");
    return;
  }
  while(fread(&data,sizeof(data),1,fp)){
    if(strcmp(data.floID,floID)) //floID != follower.floID
      fwrite(&data,sizeof(data),1,fp_tmp);
  }
  fclose(fp);
  fclose(fp_tmp);
  remove("/storage/emulated/0/FLO_Twitter/following.bin");
  rename("/storage/emulated/0/FLO_Twitter/tmp.bin", "following.bin");
  return;
}

static void storeIncoming(const struct mg_str msg){
  char buf[5000];
  snprintf(buf, sizeof(buf), "%.*s", (int) msg.len, msg.p);
  FILE *fptr;
  fptr = fopen("/storage/emulated/0/FLO_Twitter/incoming.bin","ab");
  if(fptr == NULL){
    printf("Error in opening incoming.bin\n");
    return;
  }
  fseek(fptr,0,SEEK_END);
  fwrite(&buf,sizeof(buf),1,fptr);
  fclose(fptr);
}

static void forwardIncomings(){
  char buf[5000];
  FILE *fptr;
  fptr = fopen("/storage/emulated/0/FLO_Twitter/incoming.bin","rb");
  if(fptr == NULL){
    printf("No new Incomings\n");
    return;
  }
  while(fread(&buf,sizeof(buf),1,fptr)){
    mg_send_websocket_frame(selfClient, WEBSOCKET_OP_TEXT, buf, strlen(buf));
  }
  fclose(fptr);
  remove("/storage/emulated/0/FLO_Twitter/incoming.bin");
}
static void ev_handler(struct mg_connection *nc, int ev, void *ev_data) {
  switch (ev) {
    case MG_EV_WEBSOCKET_HANDSHAKE_DONE: {
      /* New websocket connection. Tell everybody. */
      //broadcast(nc, mg_mk_str("++ joined"));
      break;
    }
    case MG_EV_WEBSOCKET_FRAME: {
      struct websocket_message *wm = (struct websocket_message *) ev_data;
      /* New websocket message. Tell everybody. */
      struct mg_str d = {(char *) wm->data, wm->size};
      if(selfClient == nc){
        if(d.p[0] == 'F')
          Follower(d);
        else if(d.p[0] == 'U')
          Unfollower(d);
        else if(d.p[0] == 'f')
          follow(d);
        else if(d.p[0] == 'u')
          unfollow(d);
        else
          storeTweet(nc, d);
      }else{
        if (d.p[0] == '$'){
          char pass[100];
          snprintf(pass, sizeof(pass), "%.*s",(int)d.len-1, &d.p[1]);
          if(!strcmp(pass,serverpass)){
            if(selfClient!=NULL)
              unicast(selfClient,mg_mk_str("$Another login is encountered! Please close/refresh this window"));
            selfClient = nc;
            unicast(selfClient,mg_mk_str("$Access Granted!"));
            forwardIncomings();
          }else
            unicast(nc,mg_mk_str("$Access Denied!"));
        }
        else if(d.p[0] == '#'){
          if(selfClient == NULL)
            unicast(nc,mg_mk_str("#-"));
          else
            unicast(nc,mg_mk_str("#+"));
        }
        else if(d.p[0] == '>'){
          sendTweets(nc, d);
        }
        else {
          if(selfClient==NULL)
            storeIncoming(d);
          else
            unicast(selfClient,d);
        }
      }
      
      break;
    }
    case MG_EV_HTTP_REQUEST: {
      mg_serve_http(nc, (struct http_message *) ev_data, s_http_server_opts);
      break;
    }
    case MG_EV_CLOSE: {
      /* Disconnect. Tell everybody. */
      if (is_websocket(nc)) {
        if(nc == selfClient){
          selfClient = NULL;
          broadcast(nc, mg_mk_str("#-"));
        }  
      }
      break;
    }
  }
}

int main(int argc, char** argv) {

  if(argc<=1){
    printf("Enter server password : ");
    scanf("%s",serverpass);
  }
  else
    strcpy(serverpass,argv[1]);

  struct mg_mgr mgr;
  struct mg_connection *nc;

  signal(SIGTERM, signal_handler);
  signal(SIGINT, signal_handler);
  setvbuf(stdout, NULL, _IOLBF, 0);
  setvbuf(stderr, NULL, _IOLBF, 0);

  mg_mgr_init(&mgr, NULL);

  nc = mg_bind(&mgr, s_http_port, ev_handler);
  mg_set_protocol_http_websocket(nc);
  s_http_server_opts.document_root = "/storage/emulated/0/FLO_Twitter/app/web/";  // Serve current directory
  s_http_server_opts.enable_directory_listing = "no";

  printf("Started on port %s\n", s_http_port);
  while (s_signal_received == 0) {
    mg_mgr_poll(&mgr, 200);
  }
  mg_mgr_free(&mgr);

  return 0;
}
