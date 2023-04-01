FROM alpine:3.14

#Install Pre-requisite
RUN apk add --no-cache git
RUN apk add --no-cache tor
RUN apk add --no-cache --update nodejs npm

#Setup requirements
WORKDIR /home/app/args
COPY dockerfiles/autogen.sh .
RUN /bin/sh autogen.sh
RUN rm autogen.sh

#Install application
WORKDIR /home/app
COPY args args
COPY public public
COPY src src
COPY test test
COPY package.json .
RUN npm install
COPY dockerfiles/run.sh .

EXPOSE 80 9050

CMD ["/bin/sh", "run.sh"]