
#include <stdio.h>
#include <stdlib.h>

struct tweetData
{
  int id;
  char data[5000];
};

struct followData{
  char floID[35];
  char sign[150];
};

int main()
{
  //Declaration
  struct tweetData tweet;
  struct followData data;
  char buf[5000];
  FILE *fptr;

  //Display Tweets
  printf("\n--Tweets--\n");
  fptr = fopen("tweet.bin","rb");
  if(fptr == NULL)
    printf("Error in opening tweet.bin\n");
  else{
    while(fread(&tweet,sizeof(tweet),1,fptr))
      printf("%d\t:%s\n", tweet.id,tweet.data);
    fclose(fptr);
  }
    
  //Display Following list
  printf("\n--Following--\n");
  fptr = fopen("following.bin","rb");
  if(fptr == NULL)
    printf("Error in opening following.bin\n");
  else{
    while(fread(&data,sizeof(data),1,fptr))
      printf("%s\t:%s\n", data.floID,data.sign);
    fclose(fptr);
  }
    
  //Display Followers list
  printf("\n--Followers--\n");
  fptr = fopen("followers.bin","rb");
  if(fptr == NULL)
    printf("Error in opening followers.bin\n");
  else{
    while(fread(&data,sizeof(data),1,fptr))
      printf("%s\t:%s\n", data.floID,data.sign);
    fclose(fptr);
  }
    
   //Display Incoming data
  printf("\n--Incoming Data--\n");
  fptr = fopen("incoming.bin","rb");
  if(fptr == NULL)
    printf("Error in opening incoming.bin\n");
  else{
    while(fread(&buf,sizeof(buf),1,fptr))
      printf("%s\n", buf);
    fclose(fptr);
  }

  return 0;
}