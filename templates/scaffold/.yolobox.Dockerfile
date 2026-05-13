USER root
RUN npm install -g --prefix /usr/local @earendil-works/pi-coding-agent

# PI_AUTORUN=1 이면 bash 시작 직후 pi를 exec
RUN echo 'if [ -n "$PI_AUTORUN" ]; then exec pi; fi' >> /etc/bash.bashrc

USER yolo
