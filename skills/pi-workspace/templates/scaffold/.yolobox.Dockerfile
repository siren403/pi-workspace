USER root
ENV PI_WORKSPACE_SANDBOX=1
ENV MISE_INSTALL_PATH=/usr/local/bin/mise
RUN npm install -g --prefix /usr/local @jdxcode/mise
RUN npm install -g --prefix /usr/local @earendil-works/pi-coding-agent@0.74.0

# PI_AUTORUN_CMD가 있으면 bash 시작 직후 해당 pi 명령을 exec
RUN echo 'if [ -n "$PI_AUTORUN_CMD" ]; then exec sh -lc "$PI_AUTORUN_CMD"; elif [ -n "$PI_AUTORUN" ]; then exec pi; fi' >> /etc/bash.bashrc

USER yolo
