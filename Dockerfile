FROM alpine:3.14

#Install Pre-requisite
RUN apk add --no-cache git
RUN apk add --no-cache tor
RUN apk add --no-cache --update nodejs npm

#Setup requirements
WORKDIR /home
COPY dockerfiles/autogen.sh .
RUN chmod +x autogen.sh
RUN ./autogen.sh
RUN rm autogen.sh
RUN mkdir app

#Install application
WORKDIR /home/app
COPY args args
COPY public public
COPY src src
COPY test test
COPY package.json .
RUN npm install

#Add run script
WORKDIR /home
COPY dockerfiles/run.sh .
RUN chmod +x run.sh

EXPOSE 80 9050

CMD ["./run.sh"]